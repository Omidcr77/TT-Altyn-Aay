def send_new_activity_email(enabled: bool, recipients: list[str], text: str) -> None:
    # Stub only: replace with SMTP integration in production
    if not enabled or not recipients:
        return
    print(f"[EMAIL-STUB] to={','.join(recipients)} text={text}")
