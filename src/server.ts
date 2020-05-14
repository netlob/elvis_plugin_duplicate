import express = require('express');
import http = require('http');
import { Application } from 'express';
import bodyParser = require('body-parser');
import { Config } from './config';
import { ElvisApi } from './elvis-api/api';
import { ApiManager } from './elvis-api/api-manager';

class Server {
    private static instance: Server;

    public static getInstance(): Server {
        return this.instance || (this.instance = new this());
    }

    private app: Application;
    private httpApp: Application;
    private apiManager: ElvisApi = ApiManager.getApi();

    private constructor() {
        this.httpApp = express();
        this.app = this.httpApp;
    }

    public start(): void {
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());
        this.app.use(this.allowCrossDomain);

        http.createServer(this.httpApp).listen(Config.httpPort, () => {
            this.logStartupMessage('HTTP Server started at port: ' + Config.httpPort);
        });

        this.app.post('/', async (req, res) => {
            try {
                const newChecksum = req.body.changedMetadata.firstExtractedChecksum.newValue;
                if (newChecksum) {
                    const search = await this.apiManager.searchGet(`firstExtractedChecksum:${newChecksum}`);
                    const duplicate = search.hits.filter(hit => {
                        if (hit.id == req.body.assetId) return false;
                        return hit.metadata.firstExtractedChecksum == newChecksum;
                    });
                    await this.apiManager.update(req.body.assetId, JSON.stringify({ cf_duplicate: !!duplicate.length }));
                    if (!!duplicate.length)
                        duplicate.forEach(async hit => await this.apiManager.createRelation(req.body.assetId, hit.id, "duplicate"));
                }
            } catch (e) {
                console.error(e);
            } finally {
                res.sendStatus(200);
            }
        });
    }

    private logStartupMessage(serverMsg: string): void {
        console.info('Running NodeJS ' + process.version + ' on ' + process.platform + ' (' + process.arch + ')');
        console.info(serverMsg);
    }

    private allowCrossDomain = function (req, res, next) {
        req = req;

        res.header('Access-Control-Allow-Origin', Config.corsHeader);
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept');

        next();
    }
}

let server: Server = Server.getInstance();
server.start();
