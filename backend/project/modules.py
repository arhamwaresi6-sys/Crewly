from datetime import datetime

from flask_login import UserMixin

from .extentions import db

from werkzeug.security import generate_password_hash, check_password_hash


# =========================================================
# USER
# =========================================================

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.now)
    status = db.Column(db.Enum("banned","active"),default="active")


    role = db.Column(
        db.Enum("root", "admin", "user", name="user_role"),
        default="user",
        nullable=False,
    )

    # Friends
    friends = db.relationship(
        "Friend",
        foreign_keys="Friend.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Invitations received by this user
    invitations = db.relationship(
        "Invitation",
        foreign_keys="Invitation.user_id",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Invitations sent by this user
    sent_invitations = db.relationship(
        "Invitation",
        foreign_keys="Invitation.sent_by_id",
        back_populates="sender",
    )

    # Notifications
    notifications = db.relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Events this user participates in
    crew_at = db.relationship(
        "Crew",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Events created by this user
    created_events = db.relationship(
        "Event",
        foreign_keys="Event.created_by_id",
        back_populates="created_by",
    )

    # Comments
    comments = db.relationship(
        "Comment",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Payments sent by this user
    payments_sent = db.relationship(
        "Payment",
        foreign_keys="Payment.sender_id",
        back_populates="sender",
    )

    # Payments received by this user
    payments_received = db.relationship(
        "Payment",
        foreign_keys="Payment.receiver_id",
        back_populates="receiver",
    )
    @property
    def password(self):
        return "nice try!"
    @password.setter
    def password(self,pas):
        self.password_hash = generate_password_hash(pas)
    @property
    def owe(self):
        total = sum(
            crew.expense + crew.extra - crew.paid - crew.budget
            for crew in self.crew_at
            if crew.status == "unpaid"
        )

        return max(total, 0)
    @property
    def paid(self):
        return db.session.execute(db.select(db.func.sum(Crew.paid)).where(Crew.user_id == self.id)).scalar_one_or_none() or 0
    
    @property
    def count_invitation(self):
        return db.session.execute(db.select(db.func.count(Invitation.id)).where(Invitation.user_id == self.id,Invitation.status == "pending")).scalar_one_or_none() or 0
    
    @property
    def count_active_event(self):
        return db.session.execute(db.select(db.func.count(Crew.id)).join(Event,Crew.event_id==Event.id).where(Crew.user_id == self.id,db.or_(
                    Event.status == "ongoing",
                    Event.status == "upcoming"
                ))).scalar_one_or_none() or 0
    @property
    def count_event(self):
        return db.session.execute(
            db.select(db.func.count(Crew.id))
            .where(Crew.user_id == self.id)
        ).scalar_one()
        


# =========================================================
# FRIEND
# =========================================================

class Friend(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    friend_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    # The user who added the friend
    user = db.relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="friends",
    )

    # The actual friend
    friend = db.relationship(
        "User",
        foreign_keys=[friend_id],
    )


# =========================================================
# NOTIFICATION
# =========================================================

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    message = db.Column(db.Text, nullable=False)

    created_at = db.Column(
        db.DateTime,
        default=datetime.now,
    )

    type = db.Column(
        db.Enum(
            "announce",
            "edit",
            "invitation",
            "other",
            name="notification_type",
        ),
        default="other",
        nullable=False,
    )

    user = db.relationship(
        "User",
        back_populates="notifications",
    )


# =========================================================
# EVENT
# =========================================================

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(50), nullable=False)

    start_at = db.Column(db.DateTime, nullable=True)
    end_at = db.Column(db.DateTime, nullable=True)

    status = db.Column(
        db.Enum(
            "upcoming",
            "ongoing",
            "completed",
            "cancelled",
            name="event_status",
        ),
        default="upcoming",
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.now,
    )

    created_by_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    category = db.Column(
        db.Enum(
            "birthday",
            "housing",
            "hangout",
            "dinner",
            "lunch",
            "trip",
            "party",
            "wedding",
            "graduation",
            "movie",
            "sports",
            "study",
            "shopping",
            "festival",
            "other",
            name="event_category",
        ),
        default="hangout",
        nullable=False,
    )

    # Budget allocated for the event
    budget = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )

    # Kept from your original model.
    # This is separate from the calculated expense and budget.
    expense = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )

    description = db.Column(
        db.Text,
        default="No Description!",
    )

    # Event creator
    created_by = db.relationship(
        "User",
        foreign_keys=[created_by_id],
        back_populates="created_events",
    )

    # People participating in the event
    crews = db.relationship(
        "Crew",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    # Products purchased for the event
    products = db.relationship(
        "Product",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    # General event expenses
    spendings = db.relationship(
        "Spending",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    # Event activity history
    activities = db.relationship(
        "Activity",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    # Event comments
    comments = db.relationship(
        "Comment",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    # Event payments
    payments = db.relationship(
        "Payment",
        back_populates="event",
        cascade="all, delete-orphan",
    )

    # Event invitations
    invitations = db.relationship(
        "Invitation",
        back_populates="event",
        cascade="all, delete-orphan",
    )
    responsibilities = db.relationship(
    "Responsibility",
    back_populates="event",
    cascade="all, delete-orphan",
)

    @property
    def calculate_expense(self):
        total_crew_expense = 0
        for crew in self.crews:
            total_crew_expense += crew.expense + crew.extra
        product_total = (
            db.session.scalar(
                db.select(
                    db.func.sum(Product.price * Product.quantity)
                ).where(Product.event_id == self.id)
            )
            or 0
        )

        spending_total = (
            db.session.scalar(
                db.select(
                    db.func.sum(Spending.cost)
                ).where(Spending.event_id == self.id)
            )
            or 0
        )

        return product_total + spending_total + total_crew_expense + self.expense

    @property
    def remains(self):

        return self.budget - self.calculate_expense


# =========================================================
# CREW
# =========================================================

class Crew(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    # Amount this member is responsible for
    expense = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )
    budget = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )

    # Amount this member has paid
    paid = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )

    status = db.Column(
        db.Enum(
            "paid",
            "unpaid",
            name="crew_payment_status",
        ),
        default="unpaid",
        nullable=False,
    )

    role = db.Column(
    db.String(20),
    default="member",
    nullable=False,
)

    # Relationships
    event = db.relationship(
        "Event",
        back_populates="crews",
    )

    user = db.relationship(
        "User",
        back_populates="crew_at",
    )

    spendings = db.relationship(
        "Person_Spending",
        back_populates="crew",
        cascade="all, delete-orphan",
    )
    # Responsibilities assigned to this crew member
    responsibilities = db.relationship(
        "Responsibility",
        foreign_keys="Responsibility.crew_id",
        back_populates="crew",
        cascade="all, delete-orphan",
    )

    # Responsibilities this crew member assigned to others
    responsibilities_given = db.relationship(
        "Responsibility",
        foreign_keys="Responsibility.assigned_by_id",
        back_populates="assigned_by",
        cascade="all, delete-orphan",
    )

    @property
    def extra(self):
        

        total = 0

        for spending in self.spendings:
            if spending.type == "increase":
                total += spending.cost
            else:
                total -= spending.cost

        return total


# =========================================================
# INDIVIDUAL MEMBER SPENDING ADJUSTMENT
# =========================================================

class Person_Spending(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(50), nullable=False)

    cost = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )

    type = db.Column(
        db.Enum(
            "increase",
            "decrease",
            name="person_spending_type",
        ),
        default="increase",
        nullable=False,
    )

    crew_id = db.Column(
        db.Integer,
        db.ForeignKey("crew.id", ondelete="CASCADE"),
        nullable=False,
    )

    crew = db.relationship(
        "Crew",
        back_populates="spendings",
    )


# =========================================================
# GENERAL EVENT SPENDING
# =========================================================

class Spending(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(50), nullable=False)

    cost = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )

    description = db.Column(
        db.Text,
        default="No Description!",
    )

    event = db.relationship(
        "Event",
        back_populates="spendings",
    )


# =========================================================
# PRODUCT
# =========================================================

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(50), nullable=False)

    price = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )

    quantity = db.Column(
        db.Integer,
        default=0,
        nullable=False,
    )

    category = db.Column(
        db.Enum(
            "food",
            "drinks",
            "groceries",
            "snacks",
            "electronics",
            "clothing",
            "accessories",
            "household",
            "transport",
            "entertainment",
            "health",
            "beauty",
            "stationery",
            "sports",
            "other",
            name="product_category",
        ),
        default="other",
        nullable=False,
    )

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )

    event = db.relationship(
        "Event",
        back_populates="products",
    )

    @property
    def total_price(self):
        """Calculate the total cost of this product."""

        return self.price * self.quantity


# =========================================================
# EVENT ACTIVITY
# =========================================================

class Activity(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )

    message = db.Column(db.Text, nullable=False)

    created_at = db.Column(
        db.DateTime,
        default=datetime.now,
    )

    event = db.relationship(
        "Event",
        back_populates="activities",
    )


# =========================================================
# PAYMENT
# =========================================================

class Payment(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    amount = db.Column(
        db.Integer,
        nullable=False,
    )

    status = db.Column(
        db.Enum(
            "pending",
            "completed",
            "cancelled",
            name="payment_status",
        ),
        default="pending",
        nullable=False,
    )

    sender_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    receiver_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.now,
    )

    sender = db.relationship(
        "User",
        foreign_keys=[sender_id],
        back_populates="payments_sent",
    )

    receiver = db.relationship(
        "User",
        foreign_keys=[receiver_id],
        back_populates="payments_received",
    )

    event = db.relationship(
        "Event",
        back_populates="payments",
    )


# =========================================================
# COMMENT
# =========================================================

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    message = db.Column(
        db.Text,
        nullable=False,
    )

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.now,
    )

    event = db.relationship(
        "Event",
        back_populates="comments",
    )

    user = db.relationship(
        "User",
        back_populates="comments",
    )


# =========================================================
# INVITATION
# =========================================================

class Invitation(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    event_id = db.Column(
        db.Integer,
        db.ForeignKey("event.id", ondelete="CASCADE"),
        nullable=False,
    )

    # User who receives the invitation
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    # User who sends the invitation
    sent_by_id = db.Column(
        db.Integer,
        db.ForeignKey("user.id"),
        nullable=False,
    )

    status = db.Column(
        db.Enum(
            "pending",
            "accepted",
            "declined",
            name="invitation_status",
        ),
        default="pending",
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.now,
    )

    event = db.relationship(
        "Event",
        back_populates="invitations",
    )

    user = db.relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="invitations",
    )

    sender = db.relationship(
        "User",
        foreign_keys=[sent_by_id],
        back_populates="sent_invitations",
    )

class Responsibility(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)

    status = db.Column(
        db.Enum(
            "pending",
            "in_progress",
            "completed",
            name="responsibility_status",
        ),
        default="pending",
        nullable=False,
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.now,
        nullable=False,
    )

    # Which event this responsibility belongs to
    event_id = db.Column(
        db.Integer,
        db.ForeignKey("event.id"),
        nullable=False,
    )

    # Crew member responsible for completing it
    crew_id = db.Column(
        db.Integer,
        db.ForeignKey("crew.id"),
        nullable=False,
    )

    # Crew member who assigned the responsibility
    assigned_by_id = db.Column(
        db.Integer,
        db.ForeignKey("crew.id"),
        nullable=False,
    )

    # Relationships
    event = db.relationship(
        "Event",
        back_populates="responsibilities",
    )

    crew = db.relationship(
        "Crew",
        foreign_keys=[crew_id],
        back_populates="responsibilities",
    )

    assigned_by = db.relationship(
        "Crew",
        foreign_keys=[assigned_by_id],
        back_populates="responsibilities_given",
    )