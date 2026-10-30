from flask import Flask
from .routes.main import main
from .routes.auth import auth
from .routes.api import api
from .extentions import db,login_manager
from flask_login import login_user
from .modules import User
from .command import create_table,query1
def create_app(config="project.settings"):
  app = Flask(__name__)
  app.config.from_object(config)

  db.init_app(app)
  login_manager.init_app(app)

  #login user
  @login_manager.user_loader
  def user_loader(user_id):
    return db.session.get(User,user_id)

  app.cli.add_command(create_table)
  app.cli.add_command(query1)
  
  app.register_blueprint(main)
  app.register_blueprint(auth)
  app.register_blueprint(api,url_prefix="/api")
  return app