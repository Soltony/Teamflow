'use server';

import prisma from '@/lib/db';
import type { User } from '@prisma/client';

interface SyncUserInput {
  nameid: string;
  email: string;
  given_name: string;
  family_name: string;
  picture?: string;
  phoneNumber?: string;
}

/**
 * Ensures a user record exists in the local database corresponding to the authenticated user from the JWT.
 * It uses the unique 'nameid' from the token as the primary key.
 * @param input User data from the JWT token.
 * @returns The local user record from the database.
 */
export async function syncUser(input: SyncUserInput): Promise<User | null> {
  if (!input.email || !input.nameid) {
    console.error("Sync user failed: email or nameid missing from input.");
    return null;
  }

  try {
    const user = await prisma.user.upsert({
        where: { id: input.nameid },
        update: {
            name: `${input.given_name} ${input.family_name}`,
            firstName: input.given_name,
            lastName: input.family_name,
            avatar: input.picture,
            email: input.email,
        },
        create: {
            id: input.nameid,
            email: input.email,
            name: `${input.given_name} ${input.family_name}`,
            firstName: input.given_name,
            lastName: input.family_name,
            avatar: input.picture,
            phoneNumber: input.phoneNumber,
        }
    });
    return user;
  } catch (error) {
    console.error("Failed to sync user in database:", error);
    return null;
  }
}
