import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Log in to your ExamsKiTayari account.",
};

export default function LoginPage() {
  return <LoginForm />;
}
