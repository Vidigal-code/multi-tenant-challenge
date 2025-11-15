/**
 * Unified API response handler
 * Standardizes backend response structures to frontend expectations
 */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface MembersResponse {
  members: any[];
  total: number;
  currentUserRole: string | null;
}

export interface NotificationsResponse {
  items: any[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * Extracts data from backend response, handling various response structures
 */
export function extractData<T>(response: any): T {
  // Direct data (e.g., user profile, company details)
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    // If response has a 'data' property, use it
    if ('data' in response && response.data !== undefined) {
      return response.data as T;
    }
    // Otherwise return the response itself
    return response as T;
  }
  return response as T;
}

/**
 * Extracts paginated data from backend response
 */
export function extractPaginatedData<T>(response: any): PaginatedResponse<T> {
  const data = response?.data || response;
  
  // Handle different response structures
  if (Array.isArray(data)) {
    return {
      data: data as T[],
      total: data.length,
    };
  }
  
  if (data && typeof data === 'object') {
    // Standard paginated response: { data: [...], total: number }
    if ('data' in data && Array.isArray(data.data)) {
      return {
        data: data.data as T[],
        total: data.total ?? data.data.length,
        page: data.page,
        pageSize: data.pageSize,
      };
    }
    
    // Notifications response: { items: [...], total: number }
    if ('items' in data && Array.isArray(data.items)) {
      return {
        data: data.items as T[],
        total: data.total ?? data.items.length,
        page: data.page,
        pageSize: data.pageSize,
      };
    }
    
    // Members response: { members: [...], total: number }
    if ('members' in data && Array.isArray(data.members)) {
      return {
        data: data.members as T[],
        total: data.total ?? data.members.length,
      };
    }
  }
  
  // Fallback: empty array
  return {
    data: [],
    total: 0,
  };
}

/**
 * Extracts members data from backend response
 */
export function extractMembersData(response: any): MembersResponse {
  const data = response?.data || response;
  
  if (data && typeof data === 'object') {
    return {
      members: data.members || [],
      total: data.total ?? (data.members?.length || 0),
      currentUserRole: data.currentUserRole ?? null,
    };
  }
  
  return {
    members: [],
    total: 0,
    currentUserRole: null,
  };
}

/**
 * Extracts notifications data from backend response
 */
export function extractNotificationsData(response: any): NotificationsResponse {
  const data = response?.data || response;
  
  if (data && typeof data === 'object') {
    return {
      items: data.items || [],
      total: data.total ?? (data.items?.length || 0),
      page: data.page,
      pageSize: data.pageSize,
    };
  }
  
  return {
    items: [],
    total: 0,
  };
}

