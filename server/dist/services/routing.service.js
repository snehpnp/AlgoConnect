"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutingService = void 0;
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const socket_service_1 = require("./socket.service");
class RoutingService {
    /**
     * Assigns a single lead to the sales rep with the lowest number of total leads.
     */
    static async autoAssignLead(leadId) {
        const lead = await prismaClient_1.default.lead.findUnique({ where: { id: leadId } });
        if (!lead)
            return;
        // Get all Sales Reps (or any eligible users)
        const salesReps = await prismaClient_1.default.user.findMany({
            where: {
                role: {
                    name: { in: ['Sales Rep', 'Agent'] } // Add your specific roles here
                }
            },
            include: {
                _count: {
                    select: { leads: true }
                }
            }
        });
        if (salesReps.length === 0)
            return; // No one to assign to
        // Find the one with the least leads
        let chosenRep = salesReps[0];
        for (const rep of salesReps) {
            if (rep._count.leads < chosenRep._count.leads) {
                chosenRep = rep;
            }
        }
        // Assign
        await prismaClient_1.default.lead.update({
            where: { id: leadId },
            data: { userId: chosenRep.id }
        });
        // Notify
        const notif = await prismaClient_1.default.notification.create({
            data: {
                userId: chosenRep.id,
                title: 'New Lead Auto-Assigned',
                message: `Lead "${lead.name}" has been auto-routed to you.`,
                type: 'LEAD_ASSIGNED',
                relatedEntityId: lead.id,
                relatedEntity: 'Lead'
            }
        });
        socket_service_1.SocketService.sendToUser(chosenRep.id, 'new_notification', notif);
    }
    /**
     * Bulk auto-assign leads. Distributes them evenly among eligible users.
     */
    static async autoAssignLeadsBulk(leadIds) {
        if (leadIds.length === 0)
            return;
        const salesReps = await prismaClient_1.default.user.findMany({
            where: {
                role: {
                    name: { in: ['Sales Rep', 'Agent'] }
                }
            },
            include: {
                _count: {
                    select: { leads: true }
                }
            }
        });
        if (salesReps.length === 0)
            return;
        // Sort reps by current lead count ascending
        const sortedReps = salesReps.sort((a, b) => a._count.leads - b._count.leads);
        // Distribute
        let repIndex = 0;
        const repAssignments = new Map();
        for (const rep of sortedReps) {
            repAssignments.set(rep.id, []);
        }
        for (const leadId of leadIds) {
            const rep = sortedReps[repIndex];
            repAssignments.get(rep.id).push(leadId);
            repIndex = (repIndex + 1) % sortedReps.length;
        }
        // Apply assignments in bulk
        for (const [repId, assignedLeadIds] of Array.from(repAssignments.entries())) {
            if (assignedLeadIds.length === 0)
                continue;
            await prismaClient_1.default.lead.updateMany({
                where: { id: { in: assignedLeadIds } },
                data: { userId: repId }
            });
            // Notify user
            const notif = await prismaClient_1.default.notification.create({
                data: {
                    userId: repId,
                    title: 'Bulk Leads Auto-Assigned',
                    message: `${assignedLeadIds.length} new leads have been auto-routed to you.`,
                    type: 'LEAD_ASSIGNED',
                    relatedEntity: 'Lead'
                }
            });
            socket_service_1.SocketService.sendToUser(repId, 'new_notification', notif);
        }
    }
}
exports.RoutingService = RoutingService;
