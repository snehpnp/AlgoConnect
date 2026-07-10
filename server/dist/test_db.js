"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prismaClient_1 = __importDefault(require("./models/prismaClient"));
async function main() {
    try {
        const roles = await prismaClient_1.default.role.findMany();

        const users = await prismaClient_1.default.user.findMany({
            select: { id: true, email: true, name: true, roleId: true }
        });

    }
    catch (error) {
        console.error("Error querying DB:", error);
    }
    finally {
        await prismaClient_1.default.$disconnect();
    }
}
main();
