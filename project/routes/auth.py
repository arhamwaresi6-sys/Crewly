from flask import Blueprint,render_template,request,redirect,url_for
from flask import Blueprint
from project.extentions import db
from project.modules import User,Event 
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user,logout_user,current_user

auth = Blueprint("auth", __name__)

@auth.route("/login", methods=["POST", "GET"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))
    if request.method == "POST":
        data = request.get_json()

        email = data.get("email")
        password = data.get("password")

        user = db.session.execute(
            db.select(User).where(User.email == email)
        ).scalar_one_or_none()

        if not user:
            return {
                "message": "No account found with this email address.",
                "status": "error"
            }, 404

        if check_password_hash(user.password_hash, password):
            login_user(user, remember=True)

            return {
                "message": "You have successfully logged in.",
                "status": "success"
            }, 200

        return {
            "message": "Invalid email or password.",
            "status": "error"
        }, 401

    return render_template("login.html")
@auth.route("/register", methods=["POST"])
def register():
    if request.method == "POST":
        data = request.get_json()
        name = data.get("name")
        email = data.get("email")
        password = data.get("password")


        if(db.session.execute(
            db.select(User).where(User.email == email)
        ).scalar_one_or_none()):
            return {
    "message": "An account with this email already exists.",
    "status": "error"
}, 409
        
        
        user = User(
            name = name,
            email = email,
            password = password
        )
        db.session.add(user)
        db.session.commit()
        return {
                "message": "You have successfully created a account!.",
                "status": "success"
        }, 201
@auth.route("/logout")
def logout():
    logout_user()
    return redirect(url_for("main.index"))