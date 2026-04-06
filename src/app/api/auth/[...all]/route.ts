import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const authHandler = toNextJsHandler((request: Request) => getAuth().handler(request));

export const { GET, POST, PATCH, PUT, DELETE } = authHandler;
