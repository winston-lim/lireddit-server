import { Post } from '../entities/Post';
import { MyContext } from "src/types";
import { Arg, Ctx, Int, Mutation, Query, Resolver } from "type-graphql";

@Resolver()
export class PostResolver {
  @Mutation(() => Post)
  async createPost(
    @Arg("title") title: string,
    @Ctx() { em }: MyContext,
  ): Promise<Post> {
    const post = em.create(Post, { title });
    await em.persistAndFlush(post);
    return post;
  }
  
  @Query(( () => [Post] ))
  posts( @Ctx() ctx: MyContext ): Promise<Post[]> {
    return ctx.em.find(Post, {});
  }

  @Query( () => Post, {
    nullable: true,
  })
  async post( 
    @Arg('id', () => Int ) id: number,
    @Ctx() ctx: MyContext ): Promise<Post | null> {
    return await ctx.em.findOne(Post, { id });
  }

  @Mutation(() => Post, {
    nullable: true
  })
  async updatePost(
    @Arg("id") id: number,
    @Arg("title", ()=> String, { nullable: true}) title: string,
    @Ctx() { em }: MyContext,
  ): Promise<Post| null> {
    const post = await em.findOne(Post, { id });
    if (!post) {
      return null;
    }
    if (typeof title !== 'undefined') {
      post.title = title;
      await em.persistAndFlush(post);
      return post;
    }
    await em.persistAndFlush(post);
    return post;
  }

  @Mutation(() => Boolean)
  async deletePost(
    @Arg("id") id: number,
    @Ctx() { em }: MyContext,
  ): Promise<boolean> {
    await em.nativeDelete(Post, { id });
    return true;
  }
}