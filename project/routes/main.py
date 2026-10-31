from flask import Blueprint,render_template,request,redirect,url_for,abort,jsonify,flash
from flask_login import current_user,login_required
from sqlalchemy import select
from project.extentions import db
from project.modules import User,Event ,Person_Spending,Crew,Invitation,Notification,Activity,Friend,Spending,Product,Payment,Comment,Responsibility
from project.utils import update_event_status
from decimal import Decimal, InvalidOperation
from datetime import datetime
main = Blueprint('main',__name__)
@main.route("/")
def index():
  return render_template("index.html")
@main.route("/admin")
@login_required
def admin():
    admin_data = {
        "stats": {
            "users": User.query.count(),
            "events": Event.query.count(),
            "active_events": Event.query.filter_by(status="ongoing").count(),
            "open_reports": 0,  # No Report model yet
        },
        "users": User.query.order_by(User.created_at.desc()).all(),
        "events": Event.query.order_by(Event.created_at.desc()).all(),
        "logs": [],           # No audit log model yet
        "reports": [],        # No Report model yet
        "announcements": [],  # Populate from notifications if needed
        "settings": {
            "signups": True,
            "gmail_only": False,
            "maintenance": False,
            "max_members": 50,
        },
    }

    return render_template("admin.html", admin_data=admin_data)
@main.route("/community")
def community():
    users = db.session.execute(
        db.select(User).order_by(User.name)
    ).scalars().all()

    community_data = [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
        }
        for user in users
    ]

    return render_template(
        "community.html",
        users=users,
        community_data=community_data
    )
@main.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()

        if not name or not email:
            flash("Name and email are required.", "error")
        elif len(name) > 50:
            flash("Name must be 50 characters or fewer.", "error")
        elif len(email) > 254 or "@" not in email:
            flash("Enter a valid email address.", "error")
        else:
            existing_user = db.session.execute(
                select(User).where(
                    User.email == email,
                    User.id != current_user.id,
                )
            ).scalar_one_or_none()

            if existing_user:
                flash("That email is already in use.", "error")
            else:
                current_user.name = name
                current_user.email = email

                
                db.session.commit()
                return redirect(url_for("main.profile"))
                
                 

    return render_template("profile.html")
@main.route("/dashboard")
def dashboard():
  # Public demo browsing uses the seeded demo account; writes still require login.
  page_user = current_user if current_user.is_authenticated else db.session.get(User, 60001)
  active_event = []
  pending_invitations=[]
  total_spendings=0
  spendings = []
  activities = []
  if page_user:
    activities = db.session.execute(
       db.select(Activity).join(Event,Event.id==Activity.event_id).join(Crew,Event.id==Crew.event_id).where(Crew.user_id==page_user.id).limit(5)
    ).scalars().all()
    spendings=db.session.execute(db.select(Person_Spending).join(Crew,Crew.id == Person_Spending.crew_id).where(Crew.user_id == page_user.id).order_by(Person_Spending.cost).limit(5)).scalars().all()

    if spendings:
      for spending in spendings:
        total_spendings+= spending.cost
    for crew in page_user.crew_at:
      update_event_status(crew.event)
      if crew.event.status == "upcoming" or crew.event.status == "ongoing":
        active_event.append(crew.event)
    for invitation in page_user.invitations:
      if invitation.status == "pending":
        pending_invitations.append(invitation)
  context = {
    "active_events":active_event,
    "spendings":spendings,
    "total_spendings":total_spendings,
    "invitations":pending_invitations,
    "activities": activities,
    "page_user": page_user,
  }
  return render_template("dashboard.html",**context)
@main.route("/event/<int:event_id>")
def event(event_id):
    event = db.session.get(Event, event_id)

    if event is None:
        abort(404)

    # Show demo event details publicly without creating an authenticated session.
    page_user = current_user if current_user.is_authenticated else db.session.get(User, 60001)
    if not current_user.is_authenticated and not Crew.query.filter_by(
        event_id=event.id,
        user_id=page_user.id if page_user else None,
    ).first():
        abort(404)
    my_crew = Crew.query.filter_by(
        event_id=event.id,
        user_id=page_user.id if page_user else None
    ).first()

    return render_template(
        "event.html",
        event=event,
        my_crew=my_crew,
        page_user=page_user,
    )
@main.route("/events")
def events():
  # The demo link may open the seeded account's events; creating still needs login.
  if not current_user.is_authenticated and request.args.get("new"):
      return redirect(url_for("auth.login"))
  page_user = current_user if current_user.is_authenticated else db.session.get(User, 60001)
  eves = []
  if page_user:
     for crew in page_user.crew_at:
          eves.append(crew.event)
  context = {
     "events":eves
  }
  return render_template("events.html", page_user=page_user, **context)
@main.route("/notifications")
def notifications():
    # Let demo visitors view the seeded notification list without signing in.
    return render_template("notifications.html")

@main.route("/users")
def users():
  return render_template("users.html")



@main.route("/accept_invitation/<int:event_id>")
@login_required
def accept_invitation(event_id):
    invitation = db.session.execute(
        db.select(Invitation).where(
            Invitation.event_id == event_id,
            Invitation.user_id == current_user.id
        )
    ).scalar_one_or_none()

    if invitation is None:
        return redirect(url_for("main.events"))

    if invitation.status == "accepted":
        return redirect(url_for("main.events"))

    crew = Crew(
        event_id=event_id,
        user_id=current_user.id
    )

    invitation.status = "accepted"

    notification = Notification(
      user_id=current_user.id,
      type="invitation",
      message=f"You have accepted {invitation.sender.name.split(" ")[0]}'s invitation for {invitation.event.name} event!"
    )
    activity = Activity(
       event_id = event_id,
       message=f"{current_user.name} joined this event!"
    )

    db.session.add(crew)
    db.session.add(notification)
    db.session.add(activity)
    db.session.commit()

    return redirect(url_for("main.events"))


@main.route("/decline_invitation/<int:event_id>")
@login_required
def decline_invitation(event_id):
    invitation = db.session.execute(
        db.select(Invitation).where(
            Invitation.event_id == event_id,
            Invitation.user_id == current_user.id
        )
    ).scalar_one_or_none()

    if invitation is None:
        return redirect(url_for("main.events"))

    if invitation.status == "accepted":
        return redirect(url_for("main.events"))

    
    invitation.status = "declined"

    notification = Notification(
      user_id=current_user.id,
      type="invitation",
      message=f"You have rejected {invitation.sender.name.split(" ")[0]}'s invitation!"
    )

    db.session.add(notification)
    db.session.commit()

    return redirect(url_for("main.events"))


@main.route("/create_event", methods=["POST"])
@login_required
def create_event():
    data = request.get_json()

    if not data:
        return jsonify({"error": "Invalid JSON data"}), 400

    name = data.get("name", "").strip()
    start_at = data.get("start_at")
    end_at = data.get("end_at")

    if not name:
        return jsonify({"error": "Event name is required"}), 400

    if not start_at or not end_at:
        return jsonify({"error": "Both dates are required"}), 400

    if end_at < start_at:
        return jsonify({"error": "End date cannot be before start date"}), 400

    event = Event(
        name=name,
        category=data.get("category"),
        start_at=start_at,
        end_at=end_at,
        created_by_id=current_user.id,
        expense=data.get("expense", 0),
        budget=data.get("budget", 0),
    )

    db.session.add(event)
    db.session.flush()

    activity_data = data.get("activity", {})

    activity = Activity(
        event_id=event.id,
        message=activity_data.get(
            "message",
            f"{current_user.name} created the event",
        ),
    )
    db.session.add(activity)

    # Add the creator as a member.
    creator_crew = Crew(
        user_id=current_user.id,
        event_id=event.id,
        budget=data.get("budget", 0)
    )
    db.session.add(creator_crew)

    # Create invitations for the other users.
    for item in data.get("crews", []):
        user_id = item.get("userId") if isinstance(item, dict) else item

        if user_id is None or int(user_id) == current_user.id:
            continue

        invitation = Invitation(
            user_id=int(user_id),
            sent_by_id=current_user.id,
            event_id=event.id,
        )
        db.session.add(invitation)

    db.session.commit()

    return jsonify({
        "message": "successful",
        "event_id": event.id,
    }), 201
@main.route("/friends")
@login_required
def friends():
    search = request.args.get("q", "").strip()

    # Get my friends
    friend_rows = Friend.query.filter_by(
        user_id=current_user.id
    ).all()

    my_friends = [row.friend for row in friend_rows]

    # Find users to add
    users_query = User.query.filter(
        User.id != current_user.id,
        User.status == "active",
    )

    if search:
        users_query = users_query.filter(
            db.or_(
                User.name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        )

    users = users_query.order_by(User.name).limit(10).all()

    # Hide users who are already friends
    friend_ids = {friend.id for friend in my_friends}
    users = [user for user in users if user.id not in friend_ids]

    return render_template(
        "friends.html",
        my_friends=my_friends,
        users=users,
        search=search,
    )


@main.route("/friends/add/<int:user_id>", methods=["POST"])
@login_required
def add_friend(user_id):
    user = db.session.get(User, user_id)

    if not user or user.id == current_user.id:
        flash("You can't add this user.", "error")
        return redirect(url_for("main.friends"))

    if user.status != "active":
        flash("This user is not available.", "error")
        return redirect(url_for("main.friends"))

    # Check whether the friendship already exists
    existing = Friend.query.filter(
        db.or_(
            db.and_(
                Friend.user_id == current_user.id,
                Friend.friend_id == user.id,
            ),
            db.and_(
                Friend.user_id == user.id,
                Friend.friend_id == current_user.id,
            ),
        )
    ).first()

    if existing:
        flash("You're already friends!", "info")
    else:
        # Store both directions so both users see the friendship
        db.session.add_all([
            Friend(user_id=current_user.id, friend_id=user.id),
            Friend(user_id=user.id, friend_id=current_user.id),
        ])
        db.session.commit()
        flash(f"{user.name} added to your friends!", "success")

    return redirect(url_for("main.friends"))


@main.route("/friends/remove/<int:user_id>", methods=["POST"])
@login_required
def remove_friend(user_id):
    # Delete both directions of the friendship
    Friend.query.filter(
        db.or_(
            db.and_(
                Friend.user_id == current_user.id,
                Friend.friend_id == user_id,
            ),
            db.and_(
                Friend.user_id == user_id,
                Friend.friend_id == current_user.id,
            ),
        )
    ).delete(synchronize_session=False)

    db.session.commit()
    flash("Friend removed.", "success")

    return redirect(url_for("main.friends"))


# for event page
@main.route("/create_invitation",methods=["POST"])
@login_required
def create_invitation():
   data = request.get_json()
   email= data.get("email")
   if email:
      user_id = db.session.execute(db.select(User.id).where(User.email == email)).scalar_one_or_none()
      if user_id:
         if user_id == current_user.id:
            return  {"message": "User already exists!"}, 400
         existing_invitation = db.session.execute(db.select(Invitation).where(Invitation.user_id==user_id,Invitation.event_id==data.get("eventId"),Invitation.status!="declined")).scalar_one_or_none()

         if not existing_invitation:
            invitation = Invitation(
                sent_by_id=current_user.id,
                user_id=user_id,
                event_id=data.get("eventId")
            )
            db.session.add(invitation)
            db.session.commit()
            return {"message": "Invitation created successfully"}, 201
         else: 
            return {"message": "Invitation already exists!"}, 400
      else:
         return {"message": "No such user!"}, 400
   return {"message": "email is missing!"}, 400


@main.route("/create_spending",methods=["POST"])
@login_required
def create_spending():
   data = request.get_json()
   name = data.get("name")
   cost = data.get("cost")
   description = data.get("description")
   event_id = data.get("event_id")
   if name and cost and event_id:
      spending = Spending(
         event_id=event_id,
         name = name,
         cost = cost,
         description= description if description else "No description"
      )
      db.session.add(spending)
      db.session.commit()
      return {"message": "Spending added successfully!"}, 201
   return {"message":"Please give all required data!"},400


@main.route("/create_product",methods=["POST"])
@login_required
def create_product():
   data = request.get_json()
   name = data.get("name")
   price = data.get("price")
   quantity = data.get("quantity")
   category = data.get("category")
   event_id = data.get("event_id")
   if name and price and event_id:
      product = Product(
         event_id=event_id,
         name = name,
         price=price,
         quantity=quantity,
         category=category
      )
      db.session.add(product)
      db.session.commit()
      return {"message": "Product added successfully!"}, 201
   return {"message":"Please give all required data!"},400

@main.route("/create_payment",methods=["POST"])
@login_required
def create_payment():
   data = request.get_json()
   amount = data.get("amount")
   status = data.get("status")
   sender_id = data.get("sender_id")
   receiver_id = data.get("receiver_id")
   event_id = data.get("event_id")
   if amount and sender_id and receiver_id and event_id:
      payment = Payment(
         sender_id=sender_id,
         receiver_id=receiver_id,
         status=status,
         event_id=event_id,
         amount=amount
      )
      db.session.add(payment)
      db.session.commit()
      return {"message": "payment added successfully!"}, 201
   return {"message":"Please give all required data!"},400
@main.route("/create_comment",methods=["POST"])
@login_required
def create_comment():
   data = request.get_json()
   message = data.get("message")
   event_id = data.get("event_id")
   if message and  event_id:
      comment = Comment(
         message = message,
         user_id=current_user.id,
         event_id=event_id,
      )
      db.session.add(comment)
      db.session.commit()
      return {"message": "comment added successfully!"}, 201
   return {"message":"Please give all required data!"},400
@main.route("/create_expense",methods=["POST"])
@login_required
def create_expense():
   data = request.get_json()
   name = data.get("name")
   cost = data.get("cost")
   type = data.get("type")
   crew_id = data.get("crew_id")
   if name and  crew_id and type and cost:
      spending = Person_Spending(
         crew_id=crew_id,
         name = name,
         cost = cost,
         type = type
      )
      db.session.add(spending)
      db.session.commit()
      return {"message": "spending added successfully!"}, 201
   return {"message":"Please give all required data!"},400

@main.route("/create_my_expense",methods=["POST"])
@login_required
def create_my_expense():
   data = request.get_json()
   name = data.get("name")
   cost = data.get("cost")
   type = data.get("type")
   event_id = data.get("event_id")
   crew_id = db.session.execute(db.select(Crew.id).where(Crew.user_id==current_user.id,Crew.event_id==event_id)).scalar_one_or_none()
   if name and  crew_id and type and cost:
      spending = Person_Spending(
         crew_id=crew_id,
         name = name,
         cost = cost,
         type = type
      )
      db.session.add(spending)
      db.session.commit()
      return {"message": "spending added successfully!"}, 201
   return {"message":"Please give all required data!"},400


@main.route("/create_budget", methods=["POST"])
@login_required
def create_budget():
    data = request.get_json(silent=True) or {}

    budget = data.get("budget")
    event_id = data.get("event_id")
    crew_id = data.get("crew_id")
    action = data.get("action", "add")

    if budget is None or not crew_id or not event_id:
        return {"message": "Please give all required data!"}, 400

    try:
        budget = Decimal(str(budget))
        event_id = int(event_id)
        crew_id = int(crew_id)
    except (ValueError, TypeError, InvalidOperation):
        return {"message": "Invalid budget or ID."}, 400

    if budget <= 0:
        return {"message": "Amount must be greater than zero."}, 400

    if action not in {"add", "deduct"}:
        return {"message": "Invalid budget action."}, 400

    event = db.session.get(Event, event_id)
    crew = db.session.get(Crew, crew_id)

    if not event or not crew or crew.event_id != event.id:
        return {"message": "Event or crew member not found!"}, 404

    if event.created_by_id != current_user.id:
        return {"message": "Only the owner can manage budgets!"}, 403

    owner = db.session.execute(
        db.select(Crew).where(
            Crew.user_id == event.created_by_id,
            Crew.event_id == event.id
        )
    ).scalar_one_or_none()

    if not owner:
        return {"message": "Owner crew record is missing!"}, 400

    if crew.id == owner.id:
        return {"message": "Cannot change the owner's budget this way!"}, 400

    if action == "add":
        if owner.budget < budget:
            return {"message": "Owner doesn't have enough budget!"}, 400

        crew.budget += budget
        owner.budget -= budget

    else:
        available_budget = crew.budget - crew.expense

        if budget > available_budget:
            return {
                "message": "Cannot deduct more than the member's remaining budget!"
            }, 400

        crew.budget -= budget
        owner.budget += budget

    db.session.commit()

    return {"message": "Budget updated successfully!"}, 200


@main.route("/create_responsibility",methods=["POST"])
@login_required
def create_responsibility():
   data = request.get_json()
   title = data.get("title")
   description = data.get("description")
   event_id = data.get("event_id")
   status = data.get("status")
   crew_id = data.get("crew_id")
   if title and description and event_id and status and crew_id:
      event = db.session.get(Event,event_id)
      owner = db.session.execute(
              db.select(Crew).where(
                  Crew.user_id == event.created_by_id,
                  Crew.event_id == event.id
              )
          ).scalar_one_or_none()
      if not owner:
         return {"message": "Owner missing!"},400
      responsibility = Responsibility(
         crew_id=crew_id,
         event_id=event_id,
         title = title,
         description = description,
         status = status,
         assigned_by_id = owner.id
      )
      db.session.add(responsibility)
      db.session.commit()
      return {"message": "spending added successfully!"}, 201
   return {"message":"Please give all required data!"},400


@main.route(
    "/change_role/<int:event_id>/<int:crew_id>",
    methods=["POST"],
)
@login_required
def change_role(event_id, crew_id):
    crew = db.session.get(Crew, crew_id)

    if not crew:
        return {"message": "Crew member not found."}, 404

    role = request.form.get("role")
    allowed_roles = {"organizer", "treasurer", "member"}

    if role not in allowed_roles:
        return {"message": "Invalid role."}, 400

    if crew.event_id != event_id:
        return {"message": "Crew member does not belong to this event."}, 400

    crew.role = role
    db.session.commit()

    return redirect(url_for("main.event", event_id=event_id))
from datetime import datetime
from flask import request, redirect, url_for
from flask_login import login_required, current_user

@main.route("/update_event/<int:event_id>", methods=["POST"])
@login_required
def update_event(event_id):
    event = db.session.get(Event, event_id)
    crew = db.session.execute(db.select(Crew).where(Crew.user_id==current_user.id,Crew.event_id==event_id)).scalar_one_or_none()
    if not event or not crew:
        return {"message": "Event or crew not found."}, 404

    name = request.form.get("name","")
    description = request.form.get("description","")
    try:
        budget = Decimal(request.form.get("budget", "0"))
    except InvalidOperation:
        return {"message": "Invalid budget."}, 400
    start = datetime.strptime(
        request.form.get("start"), "%Y-%m-%dT%H:%M"
    )

    end = datetime.strptime(
        request.form.get("end"), "%Y-%m-%dT%H:%M"
    )

    now = datetime.now()

    if start > end:
        return redirect(url_for("main.event", event_id=event_id))

    event.start_at = start
    event.end_at = end
    event.budget = budget
    event.description = description
    event.name = name
    crew_budget = db.session.execute(db.select(db.func.sum(Crew.budget)).where(Crew.event_id==event_id,Crew.user_id!=current_user.id)).scalar_one_or_none()
    if crew_budget is None:
       crew_budget = 0
    crew.budget = budget - crew_budget

    if start <= now <= end:
        event.status = "ongoing"
    elif end < now:
        event.status = "completed"
    else:
        event.status = "upcoming"

    db.session.commit()

    return redirect(url_for("main.event", event_id=event_id))


@main.route("/transfer_ownership/<int:event_id>", methods=["POST"])
@login_required
def transfer_ownership(event_id):

    user_id = request.form.get("selected_person", type=int)

    if not user_id:
        return {"message": "Select a new crew member."}, 400

    event = db.session.get(Event, event_id)

    if not event:
        return {"message": "Event not found."}, 404

    if event.created_by_id != current_user.id:
        return {"message": "Only the owner can transfer ownership."}, 403

    if user_id == current_user.id:
        return {"message": "You are already the owner."}, 400

    prev_owner = db.session.execute(
        db.select(Crew).where(
            Crew.event_id == event_id,
            Crew.user_id == current_user.id
        )
    ).scalar_one_or_none()

    next_owner = db.session.execute(
        db.select(Crew).where(
            Crew.event_id == event_id,
            Crew.user_id == user_id
        )
    ).scalar_one_or_none()

    if not prev_owner or not next_owner:
        return {"message": "Crew member not found."}, 404

    # Transfer remaining budget
    next_owner.budget += prev_owner.budget - prev_owner.expense
    prev_owner.budget = prev_owner.expense

    # Transfer ownership
    event.created_by_id = user_id
    activity = Activity(
            event_id=event.id,
            message=f"ownership transfered to {next_owner.user.name} by {prev_owner.user.name}"
        )
    db.session.add(activity)
    db.session.commit()

    return redirect(url_for("main.event", event_id=event_id))