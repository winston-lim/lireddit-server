import argon2 from 'argon2';
import { User } from '../entities/User';
import { MyContext } from 'src/types';
import {
	Arg,
	Ctx,
	Field,
	InputType,
	Mutation,
	ObjectType,
	Query,
	Resolver,
} from 'type-graphql';

@InputType()
class UsernamePasswordInput {
	@Field()
	username: string;
	@Field()
	password: string;
}

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

@Resolver()
export class UserResolver {
	@Mutation(() => UserResponse)
	async register(
		@Arg('options') options: UsernamePasswordInput,
		@Ctx() { em, req }: MyContext
	): Promise<UserResponse> {
		const { username, password } = options;
		if (username.length <= 5) {
			return {
				errors: [
					{
						field: 'username',
						message: 'username must be at least 6 characters long',
					},
				],
			};
		}
		if (password.length <= 3) {
			return {
				errors: [
					{
						field: 'password',
						message: 'password must be at least 4 characters long',
					},
				],
			};
		}
		const hashedPassword = await argon2.hash(password);
		const user = em.create(User, { username, password: hashedPassword });
		try {
			await em.persistAndFlush(user);
		} catch (e) {
			if (e.code === '23505') {
				//duplicate username error
				return {
					errors: [
						{
							field: 'username',
							message: 'username is already taken',
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
		@Arg('options') options: UsernamePasswordInput,
		@Ctx() { em, req }: MyContext
	): Promise<UserResponse> {
		const { username, password } = options;
		const user = await em.findOne(User, { username });
		if (!user) {
			return {
				errors: [
					{
						field: 'username',
						message: 'User does not exist',
					},
				],
			};
		}
		const valid = await argon2.verify(user.password, password);
		if (!valid) {
			return {
				errors: [
					{
						field: 'password',
						message: 'Incorrect password',
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
	async me(@Ctx() { em, req }: MyContext): Promise<User | null> {
		if (!req.session.userId) {
			return null;
		}
		const user = await em.findOne(User, { id: req.session.userId });
		return user;
	}
}
