import click
from flask.cli import with_appcontext
from .extentions import db
from .modules import Event
 


@click.command("create_table")
@with_appcontext
def create_table():
    db.create_all()


@click.command("query1")
@with_appcontext
def query1():
    db.session.execute(db.delete(Event))
    db.session.commit()
