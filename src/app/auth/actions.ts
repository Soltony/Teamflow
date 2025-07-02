
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
 * For the admin user (identified by phone number), it enforces a specific hardcoded ID.
 * @param input User data from the JWT token and login form.
 * @returns The local user record from the database.
 */
export async function syncUser(input: SyncUserInput): Promise<User | null> {
  if (!input.email || !input.nameid) {
    console.error("Sync user failed: email or nameid missing from input.");
    return null;
  }

  const isAdminLogin = input.phoneNumber === '123-456-7890';

  try {
    if (isAdminLogin) {
      const adminId = 'b1e55c84-9055-4eb5-8bd4-a262538f7e66';
      const adminData = {
        name: `${input.given_name} ${input.family_name}`,
        firstName: input.given_name,
        lastName: input.family_name,
        avatar: input.picture,
        email: input.email,
        phoneNumber: input.phoneNumber,
      };

      // For the admin, we upsert based on their unique email to find them reliably.
      // On creation, we assign the specific admin ID.
      const user = await prisma.user.upsert({
        where: { email: input.email },
        update: adminData,
        create: {
          ...adminData,
          id: adminId,
        },
      });

      // Note: This logic cannot change the ID of a pre-existing admin user with a different ID.
      // It ensures that on first creation, the correct ID is assigned.
      if (user.id !== adminId) {
        console.warn(`Admin user with email ${input.email} has a non-standard ID (${user.id}). This cannot be automatically corrected due to database constraints.`);
      }

      return user;
    } else {
      // For all other users, the ID from the authentication server is the source of truth.
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
    }
  } catch (error) {
    console.error("Failed to sync user in database:", error);
    return null;
  }
}
