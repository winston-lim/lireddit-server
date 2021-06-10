import { UsernamePasswordInput } from "../resolvers/UsernamePasswordInput";

export const validateRegister = (options: UsernamePasswordInput) => {
	const { username, email, password } = options;
	if (username.length <= 5) {
		return [
			{
				field: "username",
				message: "username must be at least 6 characters long",
			},
		];
	}
	if (username.includes("@")) {
		return [
			{
				field: "username",
				message: "username cannot contain special characters",
			},
		];
	}
	if (!email.includes("@")) {
		return [
			{
				field: "email",
				message: "invalid email",
			},
		];
	}
	if (password.length <= 3) {
		return [
			{
				field: "password",
				message: "password must be at least 4 characters long",
			},
		];
	}
	return null;
};

export function validateChangePassword(newPassword: string) {
	if (newPassword.length <= 3) {
		return [
			{
				field: "newPassword",
				message: "password must be at least 4 characters long",
			},
		];
	}
	return null;
}
