const https = require('https');
const qs = require('querystring');
const url = require('url');

/**
* @param context {WebtaskContext}
*/
module.exports = function (context, req, res) {
    let body = '';

    if (req.method !== 'POST') {
        res.writeHead(500);
        return res.end();
    }

    req.on('data', function (data) {
        body += data;

        if (body.length > 1e6) {
            body = '';
            // Flood attack or faulty client, nuke request
            return req.connection.destroy();
        }
    });

    req.on('end', function () {
        body = qs.parse(body);
        const payload = JSON.parse(body.payload);

        if (
            payload.api_app_id === context.secrets.post_app_id &&
            payload.token === context.secrets.post_app_token
        ) {
            if (payload.actions && payload.actions[0]) {
                const action = payload.actions[0];
                const responseUrl = url.parse(payload.response_url);

                const responseOptions = {
                    host: responseUrl.host,
                    path: responseUrl.path,
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/json'
                    }
                };

                if (action.action_id === 'accept') {
                    makeRequest({
                        host: "slack.com",
                        path: "/api/users.admin.invite",
                        method: "POST",
                        headers: {
                            'Content-type': 'application/x-www-form-urlencoded'
                        }
                    }, qs.stringify({
                        token: context.secrets.slack_api_token,
                        email: action.value
                    }),
                    (err, data) => {
                        makeRequest(responseOptions, JSON.stringify({
                            text: `Request was accepted by <@${payload.user.id}>. Invite sent to ${action.value}`
                        }), () => {
                          res.writeHead(200);
                          res.end();
                        });
                    })
                } else if (action.action_id === 'reject') {
                    makeRequest(responseOptions, JSON.stringify({
                        text: `Request was rejected by <@${payload.user.id}>.`
                    }), () => {
                      res.writeHead(200);
                      res.end();
                    });
                }
            }
        }
    });
};

function makeRequest(options, body, cb) {
    const req = https.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('error', (err) => {
            cb(err);
        })
        res.on('end', () => {
            cb(null, data);
        });
    });

    if (body) {
        req.write(body);
    }

    req.end();
}