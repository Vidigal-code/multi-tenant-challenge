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


export function extractData<T>(response: any): T {
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    if ('data' in response && response.data !== undefined) {
      return response.data as T;
    }
    return response as T;
  }
  return response as T;
}


export function extractPaginatedData<T>(response: any): PaginatedResponse<T> {
  const data = response?.data || response;
  
  if (Array.isArray(data)) {
    return {
      data: data as T[],
      total: data.length,
    };
  }
  
  if (data && typeof data === 'object') {
    if ('data' in data && Array.isArray(data.data)) {
      return {
        data: data.data as T[],
        total: data.total ?? data.data.length,
        page: data.page,
        pageSize: data.pageSize,
      };
    }
    
    if ('items' in data && Array.isArray(data.items)) {
      return {
        data: data.items as T[],
        total: data.total ?? data.items.length,
        page: data.page,
        pageSize: data.pageSize,
      };
    }
    
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

