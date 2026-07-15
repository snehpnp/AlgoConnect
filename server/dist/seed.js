"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prismaClient_1 = __importDefault(require("./models/prismaClient"));
const bcrypt_1 = __importDefault(require("bcrypt"));
async function seed() {
    // 1. Create Roles
    const adminRole = await prismaClient_1.default.role.upsert({
        where: { name: 'admin' },
        update: {},
        create: { name: 'admin' },
    });
    const managerRole = await prismaClient_1.default.role.upsert({
        where: { name: 'manager' },
        update: {},
        create: { name: 'manager' },
    });
    const agentRole = await prismaClient_1.default.role.upsert({
        where: { name: 'agent' },
        update: {},
        create: { name: 'agent' },
    });
    console.log('✅ Roles created:', { adminRole, managerRole, agentRole });
    // 2. Create Test Users
    const adminPassword = await bcrypt_1.default.hash('password123', 10);
    const managerPassword = await bcrypt_1.default.hash('password123', 10);
    const agentPassword = await bcrypt_1.default.hash('password123', 10);
    const admin = await prismaClient_1.default.user.upsert({
        where: { email: 'admin@algoconnect.com' },
        update: {},
        create: {
            email: 'admin@algoconnect.com',
            password: adminPassword,
            name: 'Administrator',
            roleId: adminRole.id,
        },
    });
    const manager = await prismaClient_1.default.user.upsert({
        where: { email: 'manager@algoconnect.com' },
        update: {},
        create: {
            email: 'manager@algoconnect.com',
            password: managerPassword,
            name: 'Campaign Manager',
            roleId: managerRole.id,
        },
    });
    const agent = await prismaClient_1.default.user.upsert({
        where: { email: 'agent@algoconnect.com' },
        update: {},
        create: {
            email: 'agent@algoconnect.com',
            password: agentPassword,
            name: 'Sales Agent',
            roleId: agentRole.id,
        },
    });
    console.log('✅ Users created:', { admin: admin.email, manager: manager.email, agent: agent.email });
    // 3. Create Sample Leads
    const sampleLeads = [
        { name: 'Rohan Sharma', email: 'rohan.sharma@tatanova.com', phone: '+919876543210', source: 'LinkedIn', salesStage: 'Client Won' },
        { name: 'Alice Johnson', email: 'alice.j@prismtech.io', phone: '+15550192834', source: 'Web Form', salesStage: 'New' },
        { name: 'Michael Chang', email: 'm.chang@asiapacific.co', phone: '+85290123456', source: 'Cold Outreach', salesStage: 'Contacted' },
        { name: 'Priya Patel', email: 'priya@vistaracapital.in', phone: '+919123456789', source: 'LinkedIn', salesStage: 'Client Won' },
        { name: 'Sarah Connor', email: 's.connor@cyberdyne.org', phone: '+15550149988', source: 'Referral', salesStage: 'New' },
        { name: 'David Miller', email: 'david@millercorp.de', phone: '+498924432190', source: 'Campaign', salesStage: 'Contacted' },
        { name: 'Carlos Estavez', email: 'carlos.e@solaris.es', phone: '+341911234567', source: 'Web Form', salesStage: 'New' },
    ];
    for (const lead of sampleLeads) {
        const existingLead = await prismaClient_1.default.lead.findFirst({
            where: { email: lead.email }
        });
        if (!existingLead) {
            await prismaClient_1.default.lead.create({
                data: lead,
            });
        }
    }
    console.log('✅ Sample leads created:', sampleLeads.length);
    console.log('\n🎉 Seeding complete!\n');
    console.log('  Admin:   admin@algoconnect.com   / password123');
    console.log('  Manager: manager@algoconnect.com / password123');
    console.log('  Agent:   agent@algoconnect.com   / password123');
}
seed()
    .catch(console.error)
    .finally(() => prismaClient_1.default.$disconnect());
