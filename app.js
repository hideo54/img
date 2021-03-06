const Koa = require('koa');
const app = new Koa();
const route = require('koa-route');
const fs = require('fs');
const path = require('path');
const qs = require('querystring');
const sharp = require('sharp');

const rootDir = __dirname + '/data';

app.use(async (ctx, next) => {
    const givenPath = path.parse(ctx.path);
    const params = qs.parse(ctx.querystring);
    const cacheStr = params.cache;
    const cache = (() => {
        const convertStrToSec = str => {
            if (str === undefined) throw undefined;
            if (str === 'no') return 0;
            const numStr = str.slice(0, -1);
            const suffix = str.slice(-1);
            if (numStr.match(/^[0-9]*$/)) {
                const num = Number(numStr);
                if (suffix === 'h') return num * 3600;
                if (suffix === 'd') return num * 86400;
                if (suffix === 'm') return num * 86400 * 30;
                if (suffix === 'y') return num * 86400 * 365;
                throw  'Unknown suffix';
            } else {
                throw 'Wrong syntax';
            }
        };
        try {
            return convertStrToSec(cacheStr);
        } catch {
            return convertStrToSec('7d'); // as default
        }
    })();

    if (['.png'].includes(givenPath.ext) === false) {
        ctx.status = 400;
        ctx.body = 'Currently only .png is supported.';
        return;
    }
    const splitted = givenPath.name.split('-');
    const originalFilename = `${rootDir}${givenPath.dir}/${splitted[0]}.png`;
    const options = splitted.slice(1);
    console.log(originalFilename);

    try {
        fs.accessSync(originalFilename, fs.constants.R_OK);
    } catch (err) {
        ctx.status = 400;
        ctx.body = "No such file.";
        return false;
    }

    const widthDesc = options.filter(/./.test.bind(/^[0-9]+w$/));
    if (widthDesc.length > 2) {
        ctx.status = 400;
        ctx.body = 'You have to specify the width only once.';
    }
    const heightDesc = options.filter(/./.test.bind(/^[0-9]+h$/));
    if (heightDesc.length > 2) {
        ctx.status = 400;
        ctx.body = 'You have to specify the height only once.';
    }
    const width = widthDesc.length === 0 ? undefined : parseInt(widthDesc[0].slice(0, -1));
    const height = heightDesc.length === 0 ? undefined : parseInt(heightDesc[0].slice(0, -1));
    if (options.includes('cover')) {
        if (options.includes('contain')) {
            ctx.status = 400;
            ctx.body = 'You have to decide either contain mode or cover mode.';
        } else {
            // cover mode
            ctx.status = 200;
            ctx.type = 'image/png';
            ctx.response.header['Cache-Control'] = `max-age=${cache}`;
            ctx.body = await sharp(originalFilename)
                .resize(width, height, { fit: 'cover' })
                .png()
                .toBuffer();
        }
    } else {
        // contain mode (even unless the mode is specified, as default)
        ctx.status = 200;
        ctx.type = 'image/png';
        ctx.set('Cache-Control', `max-age=${cache}`);
        const backgroundColor = { r: 255, g: 255, b: 255, alpha: 0 }; // TEMPORARY. The method to change this param is not implemented yet.
        ctx.body = await sharp(originalFilename)
            .resize(width, height, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 0 }
            })
            .png()
            .toBuffer();
    }
});

module.exports = app;