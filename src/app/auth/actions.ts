
'use server';

import prisma from '@/lib/db';
import type { User } from '@prisma/client';

interface SyncUserInput {
  id: string;
  email: string;
  given_name: string;
  family_name: string;
  picture?: string;
  phoneNumber?: string;
}

/**
 * Ensures a user record exists in the local database corresponding to the authenticated user from the JWT.
 * It uses the unique identifier from the token as the primary key.
 * For the admin user (identified by a specific ID), it also ensures the Admin role is always assigned.
 * @param input User data from the JWT token and login form.
 * @returns The local user record from the database.
 */
export async function syncUser(input: SyncUserInput) {
  if (!input.email || !input.id) {
    console.error("Sync user failed: email or id missing from input.");
    return null;
  }

  // The admin user is identified by a specific ID.
  const isAdminById = input.id === 'b1e55c84-9055-4eb5-8bd4-a262538f7e66';

  try {
    let user;
    if (isAdminLogin) {
      const adminId = 'b1e55c84-9055-4eb5-8bd4-a262538f7e66';
      const adminData = {
        name: `${input.given_name} ${input.family_name}`,
        firstName: input.given_name,
        lastName: input.family_name,
        avatar: input.picture,
        email: input.email,
        roles: {
            set: [{ id: adminRole.id }]
        }
      };

      const adminCreatePayload = {
        ...adminUpdatePayload,
        id: input.id,
        phoneNumber: input.phoneNumber,
      };

      // For the admin, we upsert based on their unique email to find them reliably.
      // On creation, we assign the specific admin ID.
      user = await prisma.user.upsert({
        where: { email: input.email },
        update: adminData,
        create: {
          ...adminData,
          id: adminId,
        },
        include: {
          roles: true,
        },
      });

      // Note: This logic cannot change the ID of a pre-existing admin user with a different ID.
      // It ensures that on first creation, the correct ID is assigned.
      if (user.id !== adminId) {
        console.warn(`Admin user with email ${input.email} has a non-standard ID (${user.id}). This cannot be automatically corrected due to database constraints.`);
      }
    } else {
      // For all other users, the ID from the authentication server is the source of truth.
      user = await prisma.user.upsert({
          where: { id: input.id },
          update: {
              name: `${input.given_name} ${input.family_name}`,
              firstName: input.given_name,
              lastName: input.family_name,
              avatar: input.picture,
              email: input.email,
          },
          create: {
              ...userData,
              id: input.id,
              phoneNumber: input.phoneNumber,
          },
          include: {
            roles: true
          }
      });
    }
    
    return user;

  } catch (error) {
    console.error("Failed to sync user in database:", error);
    return null;
  }
}
