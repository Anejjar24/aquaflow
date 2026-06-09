import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { userService } from '../../services/userService';

// ─── Thunks ──────────────────────────────────────────────────────────────────

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await userService.getUsers(params);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load users');
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async ({ id, payload }, { rejectWithValue }) => {
    try {
      return await userService.updateUser(id, payload);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update user');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'users/updateProfile',
  async (payload, { rejectWithValue }) => {
    try {
      return await userService.updateProfile(payload);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update profile');
    }
  }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const initialState = {
  items: [],
  meta: { total: 0, page: 1, limit: 20, pages: 0 },
  isLoading: false,
  isSaving: false,
  error: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearUsersError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchUsers
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.data || [];
        state.meta = action.payload.meta || initialState.meta;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // updateUser
      .addCase(updateUser.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.isSaving = false;
        const idx = state.items.findIndex((u) => u.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      })

      // updateProfile (does not affect the users list — just clears saving state)
      .addCase(updateProfile.pending, (state) => {
        state.isSaving = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state) => {
        state.isSaving = false;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload;
      });
  },
});

export const { clearUsersError } = usersSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectUsers = (state) => state.users.items;
export const selectUsersMeta = (state) => state.users.meta;
export const selectUsersLoading = (state) => state.users.isLoading;
export const selectUsersSaving = (state) => state.users.isSaving;
export const selectUsersError = (state) => state.users.error;

export default usersSlice.reducer;
