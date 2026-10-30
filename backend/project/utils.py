from datetime import datetime

def update_event_status(event):
    now = datetime.now()

    if now < event.start_at:
        event.status = "upcoming"

    elif event.start_at <= now <= event.end_at:
        event.status = "ongoing"

    else:
        event.status = "completed"