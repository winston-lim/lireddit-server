import { Post } from "../entities/Post";
import {
	Arg,
	Ctx,
	Field,
	FieldResolver,
	InputType,
	Int,
	Mutation,
	ObjectType,
	Query,
	Resolver,
	Root,
	UseMiddleware,
} from "type-graphql";
import { MyContext } from "../types";
import { isAuth } from "../middleware/isAuth";
import { getConnection } from "typeorm";
import { Upvote } from "../entities/Upvote";
@InputType()
class PostInput {
	@Field()
	title: string;
	@Field()
	text: string;
}

@ObjectType()
class PaginatedPosts {
	@Field(() => [Post])
	posts: Post[];

	@Field()
	hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
	@FieldResolver(() => String)
	textSnippet(@Root() root: Post) {
		return root.text.slice(0, 50);
	}

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

	@Query(() => PaginatedPosts)
	async posts(
		@Arg("limit", () => Int) limit: number,
		@Arg("cursor", () => String, { nullable: true }) cursor: string | null,
		@Ctx() { req }: MyContext
	): Promise<PaginatedPosts> {
		const realLimit = Math.min(50, limit);
		const realLimitPlusOne = realLimit + 1;

		const replacements: any[] = [realLimitPlusOne];
		if (req.session.userId) {
			replacements.push(req.session.userId);
		}
		if (cursor) {
			replacements.push(new Date(parseInt(cursor)));
		}
		console.log("########userId: ", req.session.userId);
		const posts = await getConnection().query(
			`
		select p.*,
		json_build_object(
			'id', u.id,
			'username', u.username,
			'email', u.email,
			'createdAt', u."createdAt",
			'updatedAt', u."updatedAt"
			) creator,
		${
			req.session.userId
				? '(select value from upvote where "userId" = $2 and "postId"=p.id) "voteStatus"'
				: 'null as "voteStatus"'
		}
		from post p
		inner join "public".user u on u.id = p."creatorId"
		${cursor ? `where p."createdAt" < ${req.session.userId ? "$3" : "$2"}` : ""}
		order by p."createdAt" DESC
		limit $1
		`,
			replacements
		);

		// const qb = getConnection()
		// 	.getRepository(Post)
		// 	.createQueryBuilder("p")
		// 	.innerJoinAndSelect("p.creator", "u", "u.id = p.creatorId")
		// 	.orderBy("p.createdAt", "DESC")
		// 	.take(realLimitPlusOne);
		// if (cursor) {
		// 	qb.where('p."createdAt" < :cursor', {
		// 		cursor: new Date(parseInt(cursor)),
		// 	});
		// }
		// const posts = await qb.getMany();
		return {
			posts: posts.slice(0, realLimit),
			hasMore: posts.length === realLimitPlusOne,
		};
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

	@Mutation(() => Boolean)
	async vote(
		@Arg("postId", () => Int) postId: number,
		@Arg("value", () => Int) value: number,
		@Ctx() { req }: MyContext
	) {
		const isUpvote = value !== -1;
		const upvoteValue = isUpvote ? 1 : -1;
		const { userId } = req.session;

		const upvote = await Upvote.findOne({ where: { postId, userId } });

		if (upvote && upvote.value !== upvoteValue) {
			await getConnection().transaction(async (tm) => {
				await tm.query(
					`
				update upvote
				set value = $1
				where "postId" = $2
				`,
					[upvoteValue, postId]
				);
				await tm.query(
					`
				update post
				set points = points + $1
				where "id" = $2
				`,
					[2 * upvoteValue, postId]
				);
			});
			return true;
		} else if (!upvote) {
			await getConnection().transaction(async (tm) => {
				await tm.query(
					`
				insert into upvote ("userId", "postId", value)
				values ($1, $2, $3)
				`,
					[userId, postId, upvoteValue]
				);
				await tm.query(
					`
				update post
				set points = points + $1
				where id = $2
				`,
					[upvoteValue, postId]
				);
			});
			return true;
		} else {
			return false;
		}
	}
}
