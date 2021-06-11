import "reflect-metadata";
import express from "express";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import Redis from "ioredis";
import session from "express-session";
import connectRedis from "connect-redis";
require("dotenv").config("/src/.env");
import { COOKIE_NAME, __prod__ } from "./constants";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import { MyContext } from "./types";
import cors from "cors";
import { createConnection } from "typeorm";
import { User } from "./entities/User";
import { Post } from "./entities/Post";
declare module "express-session" {
	export interface SessionData {
		userId: number;
	}
}

const start = async () => {
	const conn = await createConnection({
		type: "postgres",
		database: "lireddit2",
		username: "postgres",
		password: "6928891Zz",
		logging: true,
		synchronize: true,
		entities: [Post, User],
	});

	const app = express();

	const RedisStore = connectRedis(session);
	const redis = new Redis();

	app.use(
		session({
			name: COOKIE_NAME,
			store: new RedisStore({
				client: redis,
				disableTouch: true,
				disableTTL: true,
			}),
			cookie: {
				maxAge: 1000 * 60 * 60 * 24 * 365 * 10, //10 years in milliseconds
				httpOnly: true, //cannot access cookie from front end
				secure: __prod__, //cookie only works in https
				sameSite: "lax", //csrf
			},
			saveUninitialized: false,
			secret: "random secret",
			resave: false,
		})
	);
	app.use(
		cors({
			origin: "http://localhost:3000",
			credentials: true,
		})
	);

	const apolloServer = new ApolloServer({
		schema: await buildSchema({
			resolvers: [HelloResolver, PostResolver, UserResolver],
			validate: false, //to avoid using default validator
		}),
		context: ({ req, res }): MyContext => ({ req, res, redis }),
	});

	apolloServer.applyMiddleware({
		app,
		cors: false,
	});

	app.listen(4000, () => {
		console.log("server started on localhost:4000");
	});
};

start();
