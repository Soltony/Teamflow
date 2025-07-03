
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
 * For the admin user (identified by a hardcoded ID), it also ensures the Admin role is always assigned.
 * @param input User data from the JWT token and login form.
 * @returns The local user record from the database.
 */
export async function syncUser(input: SyncUserInput): Promise<User | null> {
  if (!input.email || !input.id) {
    console.error("Sync user failed: email or id missing from input.");
    return null;
  }

  const adminId = 'b1e55c84-9055-4eb5-8bd4-a262538f7e66';
  const isHardcodedAdmin = input.id === adminId;

  try {
    if (isHardcodedAdmin) {
      const adminRole = await prisma.role.findUnique({
          where: { name: 'Admin' },
          select: { id: true }
      });
      if (!adminRole) {
          throw new Error("Admin role not found in database. Please seed the database to create it.");
      }
      
      const adminUpdatePayload = {
        name: `${input.given_name} ${input.family_name}`,
        firstName: input.given_name,
        lastName: input.family_name,
        avatar: input.picture,
        email: input.email,
        phoneNumber: input.phoneNumber,
        roles: {
            set: [{ id: adminRole.id }]
        }
      };

      const adminCreatePayload = {
        ...adminUpdatePayload,
        id: adminId,
      };

      const user = await prisma.user.upsert({
        where: { id: adminId }, // Always look up admin by the hardcoded ID
        update: adminUpdatePayload,
        create: adminCreatePayload,
        include: {
            roles: true,
        },
      });

      return user;

    } else {
      // For all other users, the ID from the authentication server is the source of truth.
      // Their roles are managed in the UI and are not modified on login.
      const userData = {
            name: `${input.given_name} ${input.family_name}`,
            firstName: input.given_name,
            lastName: input.family_name,
            avatar: input.picture,
            email: input.email,
      };

      const user = await prisma.user.upsert({
          where: { id: input.id },
          update: userData,
          create: {
              ...userData,
              id: input.id,
              phoneNumber: input.phoneNumber,
          },
          include: {
              roles: true,
          }
      });
      return user;
    }
  } catch (error) {
    console.error("Failed to sync user in database:", error);
    return null;
  }
}
