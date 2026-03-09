import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function identifyHandler(req: Request, res: Response) {
  const { email, phoneNumber } = req.body || {};

  const emailStr = email ? String(email) : null;
  const phoneStr = phoneNumber ? String(phoneNumber) : null;

  if (!emailStr && !phoneStr) {
    return res.status(400).json({ error: "email or phoneNumber is required" });
  }

  // Find all contacts matching the email or phone
  const matchingContacts = await prisma.contact.findMany({
    where: {
      OR: [
        ...(emailStr ? [{ email: emailStr }] : []),
        ...(phoneStr ? [{ phoneNumber: phoneStr }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // If no matches, create a new primary contact
  if (matchingContacts.length === 0) {
    const newContact = await prisma.contact.create({
      data: {
        email: emailStr,
        phoneNumber: phoneStr,
        linkPrecedence: "primary",
      },
    });
    return res.status(200).json({
      contact: {
        primaryContatctId: newContact.id,
        emails: emailStr ? [emailStr] : [],
        phoneNumbers: phoneStr ? [phoneStr] : [],
        secondaryContactIds: [],
      },
    });
  }

  // Collect all primary IDs (resolve linked ones)
  const primaryIds = new Set<number>();
  for (const contact of matchingContacts) {
    if (contact.linkPrecedence === "primary") {
      primaryIds.add(contact.id);
    } else if (contact.linkedId) {
      primaryIds.add(contact.linkedId);
    }
  }

  // Fetch all primary contacts
  const primaryContacts = await prisma.contact.findMany({
    where: { id: { in: Array.from(primaryIds) } },
    orderBy: { createdAt: "asc" },
  });

  // The oldest primary becomes THE primary; others become secondary
  const primaryContact = primaryContacts[0];
  const primaryIdsToConvert = primaryContacts.slice(1).map((c) => c.id);

  if (primaryIdsToConvert.length > 0) {
    // Turn newer primaries into secondaries linked to the oldest
    await prisma.contact.updateMany({
      where: { id: { in: primaryIdsToConvert } },
      data: {
        linkedId: primaryContact.id,
        linkPrecedence: "secondary",
      },
    });

    // Re-link their secondaries to the oldest primary
    await prisma.contact.updateMany({
      where: { linkedId: { in: primaryIdsToConvert } },
      data: { linkedId: primaryContact.id },
    });
  }

  // Check if we need to create a new secondary contact
  // (incoming request has new info not already in the linked group)
  const allLinked = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryContact.id }, { linkedId: primaryContact.id }],
    },
    orderBy: { createdAt: "asc" },
  });

  const existingEmails = new Set(allLinked.map((c) => c.email).filter(Boolean));
  const existingPhones = new Set(
    allLinked.map((c) => c.phoneNumber).filter(Boolean)
  );

  const hasNewEmail = emailStr && !existingEmails.has(emailStr);
  const hasNewPhone = phoneStr && !existingPhones.has(phoneStr);

  if (hasNewEmail || hasNewPhone) {
    await prisma.contact.create({
      data: {
        email: emailStr,
        phoneNumber: phoneStr,
        linkedId: primaryContact.id,
        linkPrecedence: "secondary",
      },
    });
  }

  // Fetch final state of all linked contacts
  const finalContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primaryContact.id }, { linkedId: primaryContact.id }],
    },
    orderBy: { createdAt: "asc" },
  });

  const emails: string[] = [];
  const phoneNumbers: string[] = [];
  const secondaryContactIds: number[] = [];

  for (const c of finalContacts) {
    if (c.email && !emails.includes(c.email)) emails.push(c.email);
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber))
      phoneNumbers.push(c.phoneNumber);
    if (c.id !== primaryContact.id) secondaryContactIds.push(c.id);
  }

  return res.status(200).json({
    contact: {
      primaryContatctId: primaryContact.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  });
}
