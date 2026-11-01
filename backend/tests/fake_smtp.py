"""A small fake SMTP server for the tests of integrations/smtp.py. Nothing leaves the machine.

It speaks just enough SMTP for one message: the greeting, EHLO (offering STARTTLS and AUTH PLAIN),
STARTTLS (the connection really becomes TLS, with a throw-away certificate made here), AUTH PLAIN,
MAIL FROM, RCPT TO, DATA and QUIT. It records what it was given, so a test can check that the
password was only sent after TLS began. Options let a test make it refuse the login, refuse the
recipient, or leave STARTTLS out. Every name and address is fictional.
"""

import asyncio
import base64
import datetime
import ipaddress
import ssl
from dataclasses import dataclass, field
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def make_certificate(folder: Path) -> tuple[Path, Path]:
    """A self-signed certificate for 127.0.0.1 and localhost; returns (certificate file, key file)."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.datetime.now(datetime.timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=1))
        .add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
            ),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    certificate_file, key_file = folder / "fake-smtp.pem", folder / "fake-smtp.key"
    certificate_file.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    key_file.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    return certificate_file, key_file


@dataclass
class Received:
    """What one fake server was given."""

    commands: list[str] = field(
        default_factory=list
    )  # every command line, in order (AUTH shown without its secret)
    tls_started: bool = False
    password_sent_before_tls: bool = False
    username: str | None = None
    password: str | None = None
    mail_from: str | None = None
    recipients: list[str] = field(default_factory=list)
    message: str = ""  # the text after DATA
    message_bytes: bytes = (
        b""  # the same, as the bytes that came (a body with a non-ASCII letter is not 7-bit)
    )


class FakeSmtpServer:
    def __init__(
        self,
        certificate: Path,
        key: Path,
        *,
        offer_starttls: bool = True,
        reject_login: bool = False,
        reject_recipient: bool = False,
    ) -> None:
        self.received = Received()
        self.offer_starttls = offer_starttls
        self.reject_login = reject_login
        self.reject_recipient = reject_recipient
        self.tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        self.tls.load_cert_chain(certificate, key)
        self.trust = ssl.create_default_context(
            cafile=str(certificate)
        )  # what a client needs to trust this server
        self._server: asyncio.AbstractServer | None = None
        self.port = 0

    async def start(self) -> None:
        self._server = await asyncio.start_server(self._talk, "127.0.0.1", 0)
        self.port = self._server.sockets[0].getsockname()[1]

    async def stop(self) -> None:
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()

    async def _talk(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        async def say(line: str) -> None:
            writer.write(f"{line}\r\n".encode())
            await writer.drain()

        async def hear_bytes() -> bytes:
            return (await reader.readline()).rstrip(b"\r\n")

        async def hear() -> str:
            return (await hear_bytes()).decode()

        try:
            await say("220 fake.example.test ESMTP ready")
            while True:
                line = await hear()
                if not line:
                    break
                verb = line.split(" ", 1)[0].upper()
                self.received.commands.append("AUTH PLAIN <hidden>" if verb == "AUTH" else line)
                if verb == "EHLO":
                    extensions = ["250-fake.example.test"]
                    if self.offer_starttls and not self.received.tls_started:
                        extensions.append("250-STARTTLS")
                    extensions.append("250 AUTH PLAIN")
                    for extension in extensions:
                        await say(extension)
                elif verb == "STARTTLS":
                    await say("220 go ahead")
                    try:
                        await writer.start_tls(self.tls)
                    except (ssl.SSLError, ConnectionError):
                        break  # the client did not trust the certificate and hung up
                    self.received.tls_started = True
                elif verb == "AUTH":
                    if not self.received.tls_started:
                        self.received.password_sent_before_tls = True
                    parts = line.split(" ")
                    _, username, password = base64.b64decode(parts[2]).decode().split("\x00")
                    if self.reject_login:
                        await say("535 5.7.8 credentials not accepted")
                        continue
                    self.received.username, self.received.password = username, password
                    await say("235 2.7.0 accepted")
                elif verb == "MAIL":
                    self.received.mail_from = line.split(":", 1)[1].strip().strip("<>")
                    await say("250 ok")
                elif verb == "RCPT":
                    if self.reject_recipient:
                        await say("550 no such user")
                        continue
                    self.received.recipients.append(line.split(":", 1)[1].strip().strip("<>"))
                    await say("250 ok")
                elif verb == "DATA":
                    await say("354 end with <CRLF>.<CRLF>")
                    lines = []
                    while (data_line := await hear_bytes()) != b".":
                        lines.append(data_line)
                    self.received.message_bytes = b"\n".join(lines)
                    self.received.message = self.received.message_bytes.decode("utf-8", errors="replace")
                    await say("250 queued")
                elif verb == "QUIT":
                    await say("221 bye")
                    break
                else:
                    await say("250 ok")
        finally:
            writer.close()
