
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

  const isAdminById = input.id === 'b1e55c84-9055-4eb5-8bd4-a262538f7e66';
  const userData = {
    name: `${input.given_name} ${input.family_name}`,
    firstName: input.given_name,
    lastName: input.family_name,
    avatar: input.picture,
    email: input.email,
  };

  try {
    let user;
    if (isAdminById) {
      // It's the admin user, ensure they have the Admin role
      const adminRole = await prisma.role.findUnique({
        where: { name: 'Admin' },
      });

      if (!adminRole) {
        console.error("Admin role not found in database. Cannot assign admin privileges.");
        // Fallback to creating the user without the admin role
        user = await prisma.user.upsert({
            where: { id: input.id },
            update: userData,
            create: {
                ...userData,
                id: input.id,
                phoneNumber: input.phoneNumber,
            },
            include: {
              roles: true
            }
        });
      } else {
        // Upsert the admin user and connect the Admin role
        user = await prisma.user.upsert({
            where: { id: input.id },
            update: {
                ...userData,
                roles: {
                    set: [{ id: adminRole.id }]
                }
            },
            create: {
                ...userData,
                id: input.id,
                phoneNumber: input.phoneNumber,
                roles: {
                    connect: { id: adminRole.id }
                }
            },
            include: {
              roles: true
            }
        });
      }
    } else {
      // For all other users, just upsert their data.
      // Roles are managed separately via the config UI for non-admins.
      user = await prisma.user.upsert({
          where: { id: input.id },
          update: userData,
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
