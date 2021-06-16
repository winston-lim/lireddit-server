import argon2 from "argon2";
import { User } from "../entities/User";
import { MyContext } from "src/types";
import {
	Arg,
	Ctx,
	Field,
	FieldResolver,
	Mutation,
	ObjectType,
	Query,
	Resolver,
	Root,
} from "type-graphql";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UsernamePasswordInput } from "./UsernamePasswordInput";
import { validateChangePassword, validateRegister } from "../utils/validator";
import { sendEmail } from "../utils/send-email";
import { v4 } from "uuid";
import { getConnection } from "typeorm";
@ObjectType()
class FieldError {
	@Field()
	field: string;

	@Field()
	message: string;
}

@ObjectType()
class UserResponse {
	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];

	@Field(() => User, { nullable: true })
	user?: User;
}

@Resolver(User)
export class UserResolver {
	@FieldResolver(() => String)
	email(@Root() user: User, @Ctx() { req }: MyContext) {
		if (req.session.userId === user.id) {
			return user.email;
		} else {
			return "";
		}
	}
	@Mutation(() => UserResponse)
	async register(
		@Arg("options") options: UsernamePasswordInput,
		@Ctx() { req }: MyContext
	): Promise<UserResponse> {
		const { username, email, password } = options;
		const errors = validateRegister(options);
		if (errors) return { errors };
		const hashedPassword = await argon2.hash(password);
		let user;
		try {
			const result = await getConnection()
				.createQueryBuilder()
				.insert()
				.into(User)
				.values({
					username,
					email,
					password: hashedPassword,
				})
				.returning("*")
				.execute();
			user = result.raw[0];
		} catch (e) {
			if (e.code === "23505") {
				//duplicate username error
				return {
					errors: [
						{
							field: "username",
							message: "username is already taken",
						},
					],
				};
			}
		}
		req.session.userId = user.id;
		return {
			user,
		};
	}

	@Mutation(() => UserResponse)
	async login(
		@Arg("usernameOrEmail") usernameOrEmail: string,
		@Arg("password") password: string,
		@Ctx() { req }: MyContext
	): Promise<UserResponse> {
		const user = await User.findOne(
			usernameOrEmail.includes("@")
				? { where: { email: usernameOrEmail } }
				: { where: { username: usernameOrEmail } }
		);
		if (!user) {
			return {
				errors: [
					{
						field: "usernameOrEmail",
						message: "User does not exist",
					},
				],
			};
		}
		const valid = await argon2.verify(user.password, password);
		if (!valid) {
			return {
				errors: [
					{
						field: "password",
						message: "Incorrect password",
					},
				],
			};
		}
		req.session.userId = user.id;
		return {
			user,
		};
	}

	@Query(() => User, { nullable: true })
	me(@Ctx() { req }: MyContext) {
		if (!req.session.userId) {
			return null;
		}
		return User.findOne(req.session.userId);
	}

	@Mutation(() => Boolean)
	logout(@Ctx() { req, res }: MyContext) {
		return new Promise((resolve) =>
			req.session.destroy((err) => {
				if (err) {
					console.log(err);
					return resolve(false);
				}
				res.clearCookie(COOKIE_NAME);
				return resolve(true);
			})
		);
	}

	@Mutation(() => Boolean)
	async forgotPassword(
		@Arg("email") email: string,
		@Ctx() { redis }: MyContext
	) {
		const user = await User.findOne({ where: { email } });
		if (!user) {
			return true;
		}
		const token = v4();
		await redis.set(
			FORGET_PASSWORD_PREFIX + token,
			user.id,
			"ex",
			1000 * 60 * 60 * 24 * 33
		); //3 days token
		sendEmail(
			email,
			"Password reset",
			`<a href="http:localhost:3000/change-password/${token}"> Click here to reset password </a>`
		);
		return true;
	}

	@Mutation(() => UserResponse)
	async changePassword(
		@Arg("newPassword") newPassword: string,
		@Arg("token") token: string,
		@Ctx() { req, redis }: MyContext
	): Promise<UserResponse> {
		const errors = validateChangePassword(newPassword);
		if (errors) return { errors };
		const userId = await redis.get(FORGET_PASSWORD_PREFIX + token);
		if (!userId) {
			return {
				errors: [
					{
						field: "token",
						message: "token is invalid or expired",
					},
				],
			};
		}
		const userIdInt = parseInt(userId);
		const user = await User.findOne({ where: { id: userIdInt } });
		if (!user) {
			return {
				errors: [
					{
						field: "token",
						message: "user no longer exists",
					},
				],
			};
		}
		await User.update(
			{ id: userIdInt },
			{ password: await argon2.hash(newPassword) }
		);
		await redis.del(FORGET_PASSWORD_PREFIX + token);
		//log in user after password change
		req.session.userId = user.id;

		return {
			user,
		};
	}
}
