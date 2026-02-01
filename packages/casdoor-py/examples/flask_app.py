"""Flask 应用示例"""
from flask import Flask, request, g, jsonify
from casdoor_py import (
    create_casdoor_server,
    CasdoorConfig,
    flask_require_auth,
)

# 初始化配置
config = CasdoorConfig(
    endpoint='https://auth.example.com',
    client_id='your-client-id',
    client_secret='your-client-secret',
    org_name='your-org',
    app_name='your-app',
    certificate='''-----BEGIN CERTIFICATE-----
YOUR CERTIFICATE HERE
-----END CERTIFICATE-----''',
)

# 创建 Casdoor 实例
casdoor = create_casdoor_server(config)

# 创建 Flask 应用
app = Flask(__name__)


@app.route('/api/auth/signin-url')
def get_signin_url():
    """获取登录 URL"""
    redirect_uri = request.args.get('redirect_uri', 'http://localhost:3000/callback')
    url = casdoor.get_signin_url(redirect_uri)
    return jsonify({'url': url})


@app.route('/api/auth/token', methods=['POST'])
def exchange_token():
    """Token 交换"""
    code = request.json.get('code')
    if not code:
        return jsonify({'error': 'Code is required'}), 400

    try:
        # 使用授权码获取 Token
        token = casdoor.get_token_sync(code)

        # 解析 JWT
        claims = casdoor.parse_jwt_token(token.access_token)

        # 获取用户信息
        user = casdoor.get_user_sync(claims.name)

        return jsonify({
            'access_token': token.access_token,
            'refresh_token': token.refresh_token,
            'expires_in': token.expires_in,
            'user': {
                'name': user.name,
                'email': user.email,
                'display_name': user.display_name,
                'avatar': user.avatar,
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/auth/refresh', methods=['POST'])
def refresh_token():
    """刷新 Token"""
    refresh_token = request.json.get('refresh_token')
    if not refresh_token:
        return jsonify({'error': 'Refresh token is required'}), 400

    try:
        token = casdoor.refresh_token_sync(refresh_token)
        return jsonify({
            'access_token': token.access_token,
            'refresh_token': token.refresh_token,
            'expires_in': token.expires_in,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/user/me')
@flask_require_auth(casdoor)
def get_current_user():
    """获取当前用户信息 (需要认证)"""
    user = g.user
    return jsonify({
        'name': user.name,
        'email': user.email,
        'display_name': user.display_name,
        'avatar': user.avatar,
        'is_admin': user.is_admin,
    })


@app.route('/api/user/update', methods=['POST'])
@flask_require_auth(casdoor)
def update_user():
    """更新用户信息 (需要认证)"""
    user = g.user
    update_data = request.json

    try:
        # 只允许更新某些字段
        allowed_fields = {'display_name', 'avatar', 'phone'}
        user_update = {
            'name': user.name,
            'owner': user.owner,
        }
        for field in allowed_fields:
            if field in update_data:
                user_update[field] = update_data[field]

        success = casdoor.update_user_sync(user_update)
        if success:
            return jsonify({'message': 'User updated successfully'})
        else:
            return jsonify({'error': 'Failed to update user'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/users')
@flask_require_auth(casdoor)
def get_users():
    """获取用户列表 (需要认证且需要管理员权限)"""
    current_user = g.user
    if not current_user.is_admin:
        return jsonify({'error': 'Admin permission required'}), 403

    try:
        users = casdoor.get_users_sync()
        return jsonify({
            'users': [
                {
                    'name': user.name,
                    'email': user.email,
                    'display_name': user.display_name,
                    'avatar': user.avatar,
                    'is_admin': user.is_admin,
                }
                for user in users
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/public')
def public_endpoint():
    """公开端点 (不需要认证)"""
    return jsonify({'message': 'This is a public endpoint'})


@app.route('/health')
def health():
    """健康检查"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
