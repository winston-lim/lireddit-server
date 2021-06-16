import { Entity, Column, BaseEntity, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "./User";
import { Post } from "./Post";

// one user can upvote many posts
// one post can have upvotes from many users

@Entity()
export class Upvote extends BaseEntity {
	//No PrimaryGeneratedColumn
	//INstead, PrimaryColumn which is based off foreign keys - userId and postId
	@Column({ type: "int" })
	value: number;

	@PrimaryColumn()
	userId: number;

	@ManyToOne(() => User, (user) => user.upvotes)
	user: User;

	@PrimaryColumn()
	postId: number;

	@ManyToOne(() => Post, (post) => post.upvotes)
	post: Post;
}
