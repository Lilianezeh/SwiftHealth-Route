FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# The demo listings step does nothing unless SEED_DEMO_LISTINGS or REMOVE_DEMO_LISTINGS is exactly "true". If it
# fails it is logged and the API still starts (seed/demo_listings.py).
# The first admin step does nothing unless all four BOOTSTRAP_ADMIN_* variables are set, never prints the password, and
# never stops the API either (app/bootstrap_admin.py, --at-startup).
CMD alembic upgrade head && { python -m seed.demo_listings || echo "Demo listings step failed"; } && { python -m app.bootstrap_admin --at-startup || echo "First admin step failed"; } && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
