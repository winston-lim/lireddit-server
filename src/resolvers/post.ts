import { Post } from "../entities/Post";
import {
	Arg,
	Ctx,
	Field,
	InputType,
	Mutation,
	Query,
	Resolver,
	UseMiddleware,
} from "type-graphql";
import { MyContext } from "../types";
import { isAuth } from "../middleware/isAuth";

@InputType()
class PostInput {
	@Field()
	title: string;
	@Field()
	text: string;
}
@Resolver()
export class PostResolver {
	@Mutation(() => Post)
	@UseMiddleware(isAuth)
	async createPost(
		@Arg("input") input: PostInput,
		@Ctx() { req }: MyContext
	): Promise<Post> {
		if (!req.session.userId) {
			throw new Error("not authenticated");
		}
		return Post.create({ ...input, creatorId: req.session.userId }).save();
	}

	@Query(() => [Post])
	async posts(): Promise<Post[]> {
		return Post.find();
	}

	@Query(() => Post, {
		nullable: true,
	})
	async post(@Arg("id") id: number): Promise<Post | undefined> {
		return Post.findOne(id);
	}

	@Mutation(() => Post, {
		nullable: true,
	})
	async updatePost(
		@Arg("id") id: number,
		@Arg("title", () => String, { nullable: true }) title: string
	): Promise<Post | null> {
		const post = await Post.findOne(id);
		if (!post) {
			return null;
		}
		if (typeof title !== "undefined") {
			await Post.update({ id }, { title });
		}
		return post;
	}

	@Mutation(() => Boolean)
	async deletePost(@Arg("id") id: number): Promise<boolean> {
		await Post.delete(id);
		return true;
	}
}
