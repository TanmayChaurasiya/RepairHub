import { describe, it, expect } from 'vitest';
import { RequestStatus, Role } from '@prisma/client';
import { validateTransition, getAllowedNextStatuses } from '../../src/services/stateMachine.js';

describe('State Machine Unit Tests', () => {
  describe('Allowed Transitions with Authorized Roles', () => {
    it('allows ADMIN to assign mechanic to SUBMITTED request', () => {
      const res = validateTransition(RequestStatus.SUBMITTED, RequestStatus.ASSIGNED, Role.ADMIN);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows MECHANIC to start INSPECTING on ASSIGNED request', () => {
      const res = validateTransition(RequestStatus.ASSIGNED, RequestStatus.INSPECTING, Role.MECHANIC);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows MECHANIC to send ESTIMATE_SENT from INSPECTING', () => {
      const res = validateTransition(RequestStatus.INSPECTING, RequestStatus.ESTIMATE_SENT, Role.MECHANIC);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows CUSTOMER to APPROVE estimate in ESTIMATE_SENT', () => {
      const res = validateTransition(RequestStatus.ESTIMATE_SENT, RequestStatus.APPROVED, Role.CUSTOMER);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows CUSTOMER to REJECT estimate in ESTIMATE_SENT', () => {
      const res = validateTransition(RequestStatus.ESTIMATE_SENT, RequestStatus.REJECTED, Role.CUSTOMER);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows MECHANIC to reopen ESTIMATE_SENT -> INSPECTING to revise estimate', () => {
      const res = validateTransition(RequestStatus.ESTIMATE_SENT, RequestStatus.INSPECTING, Role.MECHANIC);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows MECHANIC to reopen REJECTED -> INSPECTING to revise estimate', () => {
      const res = validateTransition(RequestStatus.REJECTED, RequestStatus.INSPECTING, Role.MECHANIC);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows MECHANIC to begin IN_PROGRESS after APPROVED', () => {
      const res = validateTransition(RequestStatus.APPROVED, RequestStatus.IN_PROGRESS, Role.MECHANIC);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows MECHANIC to transition IN_PROGRESS -> QC', () => {
      const res = validateTransition(RequestStatus.IN_PROGRESS, RequestStatus.QC, Role.MECHANIC);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows MECHANIC to transition QC -> COMPLETED', () => {
      const res = validateTransition(RequestStatus.QC, RequestStatus.COMPLETED, Role.MECHANIC);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows CUSTOMER to transition COMPLETED -> PAID', () => {
      const res = validateTransition(RequestStatus.COMPLETED, RequestStatus.PAID, Role.CUSTOMER);
      expect(res.valid).toBe(true);
      expect(res.statusCode).toBe(200);
    });

    it('allows CUSTOMER and ADMIN to cancel prior to work starting', () => {
      expect(validateTransition(RequestStatus.SUBMITTED, RequestStatus.CANCELLED, Role.CUSTOMER).valid).toBe(true);
      expect(validateTransition(RequestStatus.SUBMITTED, RequestStatus.CANCELLED, Role.ADMIN).valid).toBe(true);
      expect(validateTransition(RequestStatus.ASSIGNED, RequestStatus.CANCELLED, Role.CUSTOMER).valid).toBe(true);
      expect(validateTransition(RequestStatus.INSPECTING, RequestStatus.CANCELLED, Role.ADMIN).valid).toBe(true);
      expect(validateTransition(RequestStatus.ESTIMATE_SENT, RequestStatus.CANCELLED, Role.CUSTOMER).valid).toBe(true);
      expect(validateTransition(RequestStatus.REJECTED, RequestStatus.CANCELLED, Role.CUSTOMER).valid).toBe(true);
    });
  });

  describe('Forbidden Role Access (Returns 403)', () => {
    it('returns 403 when CUSTOMER tries to assign mechanic', () => {
      const res = validateTransition(RequestStatus.SUBMITTED, RequestStatus.ASSIGNED, Role.CUSTOMER);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 when MECHANIC tries to approve estimate', () => {
      const res = validateTransition(RequestStatus.ESTIMATE_SENT, RequestStatus.APPROVED, Role.MECHANIC);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 when CUSTOMER tries to start repair work', () => {
      const res = validateTransition(RequestStatus.APPROVED, RequestStatus.IN_PROGRESS, Role.CUSTOMER);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 when MECHANIC tries to complete payment', () => {
      const res = validateTransition(RequestStatus.COMPLETED, RequestStatus.PAID, Role.MECHANIC);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Illegal State Transitions (Returns 409)', () => {
    it('returns 409 when jumping from SUBMITTED directly to IN_PROGRESS', () => {
      const res = validateTransition(RequestStatus.SUBMITTED, RequestStatus.IN_PROGRESS, Role.MECHANIC);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(409);
    });

    it('returns 409 when jumping from INSPECTING directly to PAID', () => {
      const res = validateTransition(RequestStatus.INSPECTING, RequestStatus.PAID, Role.CUSTOMER);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(409);
    });

    it('returns 409 when attempting to transition backward from COMPLETED to SUBMITTED', () => {
      const res = validateTransition(RequestStatus.COMPLETED, RequestStatus.SUBMITTED, Role.ADMIN);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(409);
    });

    it('returns 409 when attempting to transition from PAID to any other state', () => {
      const res = validateTransition(RequestStatus.PAID, RequestStatus.IN_PROGRESS, Role.MECHANIC);
      expect(res.valid).toBe(false);
      expect(res.statusCode).toBe(409);
    });
  });

  describe('getAllowedNextStatuses', () => {
    it('returns correct next statuses for MECHANIC on INSPECTING', () => {
      const statuses = getAllowedNextStatuses(RequestStatus.INSPECTING, Role.MECHANIC);
      expect(statuses).toEqual([RequestStatus.ESTIMATE_SENT]);
    });

    it('returns correct next statuses for CUSTOMER on ESTIMATE_SENT', () => {
      const statuses = getAllowedNextStatuses(RequestStatus.ESTIMATE_SENT, Role.CUSTOMER);
      expect(statuses).toContain(RequestStatus.APPROVED);
      expect(statuses).toContain(RequestStatus.REJECTED);
      expect(statuses).toContain(RequestStatus.CANCELLED);
    });
  });
});
