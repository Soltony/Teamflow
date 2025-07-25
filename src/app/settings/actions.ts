

'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

interface AuthResponse {
  isSuccess: boolean;
  accessToken?: string;
  refreshToken?: string;
  errors?: string[] | string | null;
  token?: string;
  message?: string;
}

interface AuthenticatedUser {
  nameid?: string;
  sub?: string;
  email: string;
  given_name: string;
  family_name: string;
  picture?: string;
  [key: string]: any;
}

// Combined data fetching for the new unified settings page
export async function getSettingsPageData() {
  const [
    projectStatuses, 
    projects, 
    activeYearSetting,
    users,
    roles,
    pmoDivisions
  ] = await Promise.all([
    prisma.projectStatus.findMany({ orderBy: { name: 'asc' } }),
    prisma.project.findMany({ select: { workingYear: true }, distinct: ['workingYear'], orderBy: { workingYear: 'desc' } }),
    prisma.setting.findUnique({ where: { key: 'activeWorkingYear' } }),
    prisma.user.findMany({ include: { roles: true }, orderBy: { name: 'asc' } }),
    prisma.role.findMany({ orderBy: { name: 'asc' } }),
    prisma.pmoDivision.findMany({ orderBy: { name: 'asc' } })
  ]);

  return {
    projectStatuses: JSON.parse(JSON.stringify(projectStatuses)),
    projects: JSON.parse(JSON.stringify(projects)),
    activeYearSetting: JSON.parse(JSON.stringify(activeYearSetting)),
    users: JSON.parse(JSON.stringify(users)),
    roles: JSON.parse(JSON.stringify(roles)),
    pmoDivisions: JSON.parse(JSON.stringify(pmoDivisions)),
  };
}

// --- Project Status Actions ---
export async function createProjectStatus(name: string) {
    if (!name || name.trim().length < 3) {
        return { success: false, error: "Status name must be at least 3 characters." };
    }
    try {
        await prisma.projectStatus.create({ data: { name } });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to create status. It may already exist." };
    }
}

export async function updateProjectStatus(id: string, name: string) {
    if (!name || name.trim().length < 3) {
        return { success: false, error: "Status name must be at least 3 characters." };
    }
    try {
        await prisma.projectStatus.update({ where: { id }, data: { name } });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update status." };
    }
}

export async function deleteProjectStatus(id: string) {
    try {
        const projectsWithStatus = await prisma.project.count({ where: { statusId: id } });
        if (projectsWithStatus > 0) {
            return { success: false, error: "Cannot delete status as it is currently in use by projects." };
        }
        await prisma.projectStatus.delete({ where: { id } });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete status." };
    }
}

// --- General Settings Actions ---
export async function updateActiveWorkingYear(year: string) {
    try {
        await prisma.setting.upsert({
            where: { key: 'activeWorkingYear' },
            update: { value: year },
            create: { key: 'activeWorkingYear', value: year },
        });
        revalidatePath('/settings');
        revalidatePath('/dashboard');
        revalidatePath('/projects/new');
        return { success: true };
    } catch (error) {
        console.error("Failed to update active year:", error);
        return { success: false, error: "Failed to update active working year." };
    }
}

// --- User Management Actions ---
export async function updateUser(userId: string, data: { firstName: string, lastName: string, email: string, phoneNumber: string, roleIds: string[], pmoDivisionId?: string }) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                name: `${data.firstName} ${data.lastName}`,
                email: data.email,
                phoneNumber: data.phoneNumber,
                pmoDivisionId: data.pmoDivisionId,
                roles: {
                    set: data.roleIds.map(id => ({ id })),
                }
            }
        });

        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        console.error("Failed to update user:", error);
        return { success: false, error: 'Failed to update user. The email might already be in use by another account.' };
    }
}

export async function createUser(data: { firstName: string, lastName: string, email: string, phoneNumber: string, password?: string, roleIds: string[], pmoDivisionId: string }, accessToken: string) {
    if (!data.password) {
        return { success: false, error: "Password is required." };
    }
    if (!accessToken) {
        return { success: false, error: "Authentication token is missing. You may need to log in again." };
    }

    try {
        const authApiUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/register`;

        const registrationPayload = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phoneNumber: data.phoneNumber,
            password: data.password,
        };

        const registrationResponse = await axios.post<AuthResponse>(authApiUrl, registrationPayload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!registrationResponse.data.isSuccess || !registrationResponse.data.accessToken) {
            const errorValue = registrationResponse.data.errors;
            const errorMessage = Array.isArray(errorValue) ? errorValue.join(', ') : (typeof errorValue === 'string' ? errorValue : 'Failed to register user with the authentication service.');
            return { success: false, error: errorMessage };
        }

        const decodedToken = jwtDecode<AuthenticatedUser>(registrationResponse.data.accessToken);
        const userIdFromIdp = decodedToken.nameid || decodedToken.sub;

        if (!userIdFromIdp) {
            console.error("Could not find user identifier (nameid or sub) in the JWT token after registration.");
            return { success: false, error: "Registration succeeded, but the returned authentication token is invalid and is missing a user ID." };
        }

        const existingUser = await prisma.user.findUnique({
            where: { id: userIdFromIdp }
        });

        if (existingUser) {
            console.warn(`User with ID ${userIdFromIdp} already exists in local DB but was just registered.`);
             await prisma.user.update({
                where: { id: userIdFromIdp },
                data: {
                    pmoDivisionId: data.pmoDivisionId,
                    roles: {
                        set: data.roleIds.map(id => ({ id }))
                    }
                }
            });
        } else {
             await prisma.user.create({
                data: {
                    id: userIdFromIdp,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    name: `${data.firstName} ${data.lastName}`,
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    pmoDivisionId: data.pmoDivisionId,
                    roles: {
                        connect: data.roleIds.map(id => ({ id }))
                    }
                }
            });
        }
       
        revalidatePath('/settings');
        return { success: true };

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Auth service registration failed. Response:", error.response?.status, error.response?.data);
            if (error.response) {
                if (error.response.status === 401) {
                    return { success: false, error: "Authentication failed. Your session may have expired. Please log in again." };
                }
                const responseData = error.response.data as any;
                const errorValue = responseData.errors;

                let errorMessage = 'An unexpected error occurred during registration with the auth service.';
                if (Array.isArray(errorValue)) {
                    errorMessage = errorValue.join(', ');
                } else if (typeof errorValue === 'string') {
                    errorMessage = errorValue;
                }
                
                return { success: false, error: errorMessage };
            }
        }
        console.error("Failed to create user:", error);
        return { success: false, error: 'An unexpected server error occurred. Could not connect to the authentication service.' };
    }
}

export async function forgotPasswordForUser(phoneNumber: string) {
    try {
        const authApiUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/forgot-password`;
        
        const payload = { phoneNumber };

        const response = await axios.post<AuthResponse>(
            authApiUrl,
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        if (response.data.message) {
            const tokenParts = response.data.message.split('is: ');
            if (tokenParts.length > 1) {
                const token = tokenParts[1];
                return { success: true, token: token.trim() };
            }
        }
        
        const errorMessage = Array.isArray(response.data.errors) ? response.data.errors.join(', ') : 'Failed to initiate password reset.';
        return { success: false, error: errorMessage };

    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            console.error("Auth service forgot password failed. Response:", error.response.status, error.response.data);
            const responseData = error.response.data as any;
            
            let errorMessage = 'An unexpected error occurred during password reset initiation.';
             if (responseData && responseData.message) {
                errorMessage = responseData.message;
            } else if (responseData && responseData.errors) {
                const errorDetails = responseData.errors;
                if (Array.isArray(errorDetails) && errorDetails.length > 0) {
                    errorMessage = errorDetails.join(', ');
                } else if (typeof errorDetails === 'string') {
                    errorMessage = errorDetails;
                } else if (typeof errorDetails === 'object') {
                    errorMessage = Object.values(errorDetails).flat().join(' ');
                }
            }
            
            return { success: false, error: errorMessage };
        }
        console.error("Failed to initiate password reset:", error);
        return { success: false, error: 'Could not connect to the authentication service.' };
    }
}

export async function resetPasswordForUser(data: { phoneNumber: string, newPassword?: string, token: string }) {
    try {
        const authApiUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/reset-password`;
        const response = await axios.post(authApiUrl, data);

        if (response.data?.isSuccess || response.status === 200 || response.status === 204) {
            return { success: true };
        } else {
            const errorMessage = Array.isArray(response.data.errors) ? response.data.errors.join(', ') : 'An unknown error occurred.';
            return { success: false, error: errorMessage };
        }
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            console.error("Auth service password reset failed. Response:", error.response.status, error.response.data);
            const responseData = error.response.data as any;
            const errorValue = responseData.errors;
            let errorMessage = 'An unexpected error occurred during password reset.';
            if (Array.isArray(errorValue)) errorMessage = errorValue.join(', ');
            else if (typeof errorValue === 'string') errorMessage = errorValue;
            return { success: false, error: errorMessage };
        }
        console.error("Failed to reset password:", error);
        return { success: false, error: 'Could not connect to the authentication service.' };
    }
}

export async function deleteUser(userId: string) {
    try {
        await prisma.user.delete({
            where: { id: userId },
        });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user:", error);
        return { success: false, error: "Failed to delete user. They may be associated with projects, tasks, or teams. Please reassign their responsibilities before deleting." };
    }
}

// --- Role Management Actions ---
export async function createRole(data: { name: string, description?: string, permissions?: string[] }) {
    try {
        await prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
                permissions: data.permissions
            }
        });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        console.error("Failed to create role:", error);
        return { success: false, error: 'A role with this name may already exist.' };
    }
}

export async function updateRole(id: string, data: { name: string, description?: string, permissions?: string[] }) {
    try {
        await prisma.role.update({
            where: { id },
            data
        });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        console.error("Failed to update role:", error);
        return { success: false, error: 'Failed to update role.' };
    }
}

export async function deleteRole(id: string) {
    try {
        const usersWithRole = await prisma.user.count({
            where: { roles: { some: { id } } }
        });
        if (usersWithRole > 0) {
            return { success: false, error: 'Cannot delete role as it is currently assigned to one or more users.' };
        }
        await prisma.role.delete({ where: { id } });
        revalidatePath('/settings');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete role:", error);
        return { success: false, error: 'Failed to delete role.' };
    }
}

    