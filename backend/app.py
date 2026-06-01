from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
from functools import wraps
import os

app = Flask(__name__)
# Enable CORS for frontend communication
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')

# Database configuration - supports both SQLite (local) and PostgreSQL (Render)
database_url = os.environ.get('DATABASE_URL', 'sqlite:///tasks.db')
# Handle postgres:// URLs from Render (they changed to postgresql://)
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Database Models ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    stage = db.Column(db.String(20), default='Todo') # Todo, In Progress, Done
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

with app.app_context():
    db.create_all()

# --- Auth Middleware ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(data['user_id'])
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
            
        return f(current_user, *args, **kwargs)
    return decorated

# --- Routes ---
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Missing data'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'User already exists'}), 409
        
    hashed_password = generate_password_hash(data['password'], method='pbkdf2:sha256')
    new_user = User(username=data['username'], password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'User created successfully!'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    
    if user and check_password_hash(user.password, data.get('password')):
        token = jwt.encode({
            'user_id': user.id,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        return jsonify({'token': token})
        
    return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/tasks', methods=['GET', 'POST'])
@token_required
def handle_tasks(current_user):
    if request.method == 'GET':
        tasks = Task.query.filter_by(user_id=current_user.id).all()
        output = [{'id': t.id, 'title': t.title, 'stage': t.stage} for t in tasks]
        return jsonify(output)
        
    if request.method == 'POST':
        data = request.get_json()
        new_task = Task(title=data['title'], stage='Todo', user_id=current_user.id)
        db.session.add(new_task)
        db.session.commit()
        return jsonify({'message': 'Task created!', 'task': {'id': new_task.id, 'title': new_task.title, 'stage': new_task.stage}}), 201

@app.route('/tasks/<int:task_id>', methods=['PUT', 'DELETE'])
@token_required
def modify_task(current_user, task_id):
    task = Task.query.filter_by(id=task_id, user_id=current_user.id).first()
    if not task:
        return jsonify({'message': 'Task not found'}), 404
        
    if request.method == 'PUT':
        data = request.get_json()
        if 'title' in data: task.title = data['title']
        if 'stage' in data: task.stage = data['stage']
        db.session.commit()
        return jsonify({'message': 'Task updated'})
        
    if request.method == 'DELETE':
        db.session.delete(task)
        db.session.commit()
        return jsonify({'message': 'Task deleted'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
