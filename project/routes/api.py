from flask import Blueprint,request,jsonify
from project.extentions import db
from project.modules import User,Event ,Notification
from flask_login import current_user,login_required
api = Blueprint("api",__name__)

@api.route("/users")
def users():
  all_users = db.session.execute(db.select(User)).scalars().all()
  return  jsonify([
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "status": user.status,
            "joined": user.created_at.date().isoformat(),
            "count_event": user.count_event,
        }
        for user in all_users
    ])

@api.route("/searched_users",methods=["POST"])
@login_required
def searched_users():
  data = request.get_json()
  searched_value = data.get("email")
  if(not searched_value):
     return jsonify([])
  users = db.session.execute(db.select(User).where(User.email.ilike(f"%{searched_value}%"),User.status=="active",User.id != current_user.id).limit(4)).scalars().all()
  return jsonify([
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
        }
        for user in users
    ])


@api.route("/friends")
@login_required
def friends():
  # The relationship contains Friend records; return each linked User for the modal.
  users = [friend.friend for friend in current_user.friends]
  return jsonify([
          {
              "id": user.id,
              "name": user.name,
              "email": user.email,
          }
          for user in users
      ])
@api.route("/notifications")
def get_notifications():
    # Anonymous visitors see only the notifications for the public demo account.
    user_id = current_user.id if current_user.is_authenticated else 60001
    notifications = db.session.execute(
        db.select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    ).scalars().all()

    return jsonify([
        {
            "id": notification.id,
            "message": notification.message,
            "created_at": notification.created_at.isoformat()
                if notification.created_at else None,
        }
        for notification in notifications
    ])
@api.route("/update_user_status",methods=["PATCH"])
def update_user_status():
   data = request.get_json()
   user_id = int(data.get("userId"))
   status = data.get("status")
   user = db.session.get(User, user_id)
   if not user:
      return {"message": "User  not found."}, 404
   user.status = status
   db.session.commit()
   return {"message": "successfully changes the status!"}, 201
@api.route("/update_user_role", methods=["PATCH"])
@login_required
def update_user_role():
    # Only root can manage roles.
    if current_user.role != "root":
        return {"message": "Only root can change user roles."}, 403

    data = request.get_json(silent=True) or {}

    user_id = data.get("userId")
    role = data.get("role")

    if user_id is None or role not in ("admin", "user"):
        return {"message": "Invalid user ID or role."}, 400

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        return {"message": "Invalid user ID."}, 400

    user = db.session.get(User, user_id)

    if not user:
        return {"message": "User not found."}, 404

    # Never allow changing the root account through this endpoint.
    if user.role == "root":
        return {"message": "The root account is protected."}, 403

    user.role = role
    db.session.commit()

    return {
        "message": "Successfully changed the role!",
        "userId": user.id,
        "role": user.role
    }, 200
@api.route("/delete_user/<int:user_id>",methods=["DELETE"])
def delete_user(user_id):
   user = db.session.get(User,user_id)
   if not user:
         return {"message": "User  not found."}, 404
   db.session.delete(user)
   db.session.commit()
   return {"message": "successfully Deleted!"}, 201
@api.route("/delete_event/<int:event_id>",methods=["DELETE"])
def delete_event(event_id):
   event = db.session.get(Event,event_id)
   if not event:
         return {"message": "User  not found."}, 404
   db.session.delete(event)
   db.session.commit()
   return {"message": "successfully Deleted!"}, 201
@api.route("/announcement", methods=["POST"])
@login_required
def announcement():
    data = request.get_json(silent=True) or {}
    message = data.get("text", "").strip()

    if not message:
        return {"message": "Announcement cannot be empty."}, 400

    user_ids = db.session.execute(
        db.select(User.id)
    ).scalars().all()

    notifications = [
        Notification(
            user_id=user_id,
            message=message,
            type="announce"
        )
        for user_id in user_ids
    ]

    db.session.add_all(notifications)
    db.session.commit()

    return {
        "message": "Announcement sent successfully.",
        "recipients": len(notifications),
    }, 200
