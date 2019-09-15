const https = require('https');
const qs = require('querystring');

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
        if (
            req.headers['content-type'] === 'application/json' ||
            req.headers['Content-Type'] === 'application/json'
        ) {
            body = JSON.parse(body);
        } else {
            body = qs.parse(body);
        }
        const redirectUrl = body.redirect_url;
        delete body.redirect_url;

        sendMessage(context.secrets.slack_access_token, context.secrets.channel, body, (err, result) => {
            if (err) {
                res.writeHead(500);
                return res.end({message: "error"});
            }

            if (redirectUrl) {
                res.redirect(redirectUrl);
                return res.end();
            }

            res.writeHead(200);
            return res.end(JSON.stringify({message: "success"}));
        })
    });
};

function sendMessage(token, channel, body, cb) {
    const fields = Object.keys(body).map((key) => {
        return {
            type: "mrkdwn",
            text: `*${key}:*\n${body[key]}`
        }
    })

    const message = {
        token: token,
        link_names: true,
        as_user: false,
        channel,
        blocks: JSON.stringify([
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "Someone has filled in the form!"
                }
            },
            {
                "type": "section",
                fields
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Approve"
                        },
                        "action_id": "accept",
                        "style": "primary",
                        "value": body.email
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Deny"
                        },
                        "action_id": "reject",
                        "style": "danger",
                        "value": "deny"
                    }
                ]
            }
        ])
    };

    makeRequest({
        host: 'slack.com',
        path: '/api/chat.postMessage',
        method: 'POST',
        headers: {
            'Content-type': 'application/x-www-form-urlencoded'
        }
    }, qs.stringify(message), (err, result) => {
        cb(err, result);
    });
}

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
