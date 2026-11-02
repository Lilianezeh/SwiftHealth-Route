FROM python:3.12-slim
# Each line a step prints shows at once in the host's log, even from a step that is later stopped.
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# start.sh runs, in this order, each under a time limit and with no input, and then the API (see the comments in that file):
#   the migrations (alembic upgrade head);
#   the demo listings step: does nothing unless SEED_DEMO_LISTINGS or REMOVE_DEMO_LISTINGS is exactly "true" (seed/demo_listings.py);
#   the first admin step: does nothing unless all four BOOTSTRAP_ADMIN_* variables are set, never prints the password (app/bootstrap_admin.py);
#   the two-factor reset step: does nothing unless RESET_TWO_FACTOR_FOR_EMAIL is set, for the only admin who lost the phone and
#   the backup codes: set it, let the API start once, delete it (app/reset_two_factor.py).
# A step that fails or is stopped is logged by name and the API still starts.
CMD ["sh", "/app/start.sh"]
