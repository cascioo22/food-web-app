"""Retrieve only this project's connector token without printing secret material.
Run with Hermes's interpreter and PYTHONPATH=/opt/hermes. The existing authenticated
Cloudflare MCP connection is used; no global configuration is edited.
"""
import base64
import json
import os
from pathlib import Path
import re
import tempfile

ACCOUNT = '5921c09fa01d24c2a1c152cf1bb2f3f2'
TUNNEL = '3e8e1561-cf85-4e5a-af29-6dd2254f7a34'
ROOT = Path(__file__).resolve().parents[1]


def unwrap(value):
    for _ in range(6):
        if isinstance(value, dict):
            if value.get('success') is False:
                raise RuntimeError('Cloudflare refused the connector-token request')
            value = value.get('result', value.get('token'))
        elif isinstance(value, str) and value.lstrip().startswith(('{', '"')):
            value = json.loads(value)
        else:
            return value
    raise RuntimeError('Unexpected Cloudflare response envelope')


async def retrieve():
    from hermes_cli.mcp_config import _get_mcp_servers
    from tools.mcp_tool_discovery import _connect_server
    config = _get_mcp_servers()['cloudflare']
    server = await _connect_server('cloudflare', config)
    try:
        names = [tool.name for tool in server._tools if tool.name == 'get_accounts_cfd_tunnel_token']
        if len(names) != 1:
            raise RuntimeError('Expected native Cloudflare token tool was not discovered')
        response = await server.session.call_tool(names[0], arguments={'account_id': ACCOUNT, 'tunnel_id': TUNNEL})
        if getattr(response, 'is_error', getattr(response, 'isError', False)):
            raise RuntimeError('Cloudflare MCP connector-token request failed')
        payload = getattr(response, 'structured_content', getattr(response, 'structuredContent', None))
        if payload is None:
            payload = json.loads(''.join(getattr(block, 'text', '') for block in response.content))
        token = unwrap(payload)
        if not isinstance(token, str) or not re.fullmatch(r'[A-Za-z0-9_+/=-]+', token):
            raise RuntimeError('Invalid connector-token format')
        claims = json.loads(base64.b64decode(token + '=' * (-len(token) % 4)))
        if claims.get('a') != ACCOUNT or claims.get('t') != TUNNEL:
            raise RuntimeError('Connector token does not match the intended account/tunnel')
        path = ROOT / '.env'
        old = path.read_text() if path.exists() else ''
        pattern = r'(?m)^(?:export\s+)?CLOUDFLARE_TUNNEL_TOKEN\s*=.*$'
        line = 'CLOUDFLARE_TUNNEL_TOKEN=' + token
        updated = re.sub(pattern, lambda _: line, old) if re.search(pattern, old) else old.rstrip('\n') + '\n' + line + '\n'
        fd, temporary = tempfile.mkstemp(prefix='.env-tunnel-', dir=ROOT)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, 'w') as stream:
                stream.write(updated)
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        # Verify without exposing the value.
        if line not in path.read_text().splitlines():
            raise RuntimeError('Connector-token persistence check failed')
        print('Connector token retrieved, account/tunnel validated, and stored in gitignored .env (0600).')
    finally:
        await server.shutdown()


if __name__ == '__main__':
    from tools.mcp_tool_loop import _ensure_mcp_loop, _run_on_mcp_loop
    from tools.mcp_tool_lifecycle import _stop_mcp_loop_if_idle
    _ensure_mcp_loop()
    try:
        _run_on_mcp_loop(retrieve(), timeout=180)
    finally:
        _stop_mcp_loop_if_idle()
