import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types/index.js';
import * as emergencyService from './emergency.service.js';

export async function discoverProviders(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { lat, lon, lng, category, radiusKm, radius, vehicleType } = req.query;

    const result = await emergencyService.discoverNearbyProviders({
      lat: Number(lat),
      lon: Number(lon || lng),
      category: category as any,
      radiusKm: Number(radiusKm || radius || 15),
      vehicleType: vehicleType as any,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createEmergencyRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pickupLat = req.body.pickupLatitude ?? req.body.latitude;
    const pickupLon = req.body.pickupLongitude ?? req.body.longitude;
    const photos = req.body.photos ?? req.body.photoUrls ?? [];
    const description = req.body.description || 'Emergency roadside breakdown assistance requested';

    const result = await emergencyService.createEmergencyRequest({
      customerId: req.user.userId,
      ...req.body,
      pickupLatitude: pickupLat,
      pickupLongitude: pickupLon,
      photos,
      description,
    });

    res.status(201).json({
      message: 'Emergency assistance request created successfully',
      emergency: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function listEmergencyRequests(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { status, search, page = '1', limit = '20' } = req.query;

    const result = await emergencyService.listEmergencyRequests({
      userId: req.user.userId,
      role: req.user.role,
      status: status as string,
      search: search as string,
      page: Math.max(1, parseInt(String(page), 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20)),
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getEmergencyRequestById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const request = await emergencyService.getEmergencyRequestById(
      id,
      req.user.userId,
      req.user.role
    );

    res.json({ emergency: request });
  } catch (err) {
    next(err);
  }
}

export async function acceptEmergencyRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const updated = await emergencyService.acceptEmergencyRequest(id, req.user.userId);

    res.json({
      message: 'Emergency request accepted successfully. Live location sharing initiated.',
      emergency: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function declineEmergencyRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    const result = await emergencyService.declineEmergencyRequest(
      id,
      req.user.userId,
      reason
    );

    res.json({
      message: result.nextOffered
        ? 'Request declined. Automatically routed to next available certified provider.'
        : 'Request declined. No other nearby providers available; escalated to Master Admin.',
      emergency: result.updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateEmergencyStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { targetStatus, note } = req.body;

    const updated = await emergencyService.updateEmergencyStatus({
      requestId: id,
      targetStatus,
      actorId: req.user.userId,
      actorRole: req.user.role,
      note,
    });

    res.json({
      message: `Emergency status updated to ${targetStatus}`,
      emergency: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMechanicLocation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { latitude, longitude } = req.body;

    const result = await emergencyService.updateMechanicLiveLocation({
      requestId: id,
      mechanicUserId: req.user.userId,
      latitude,
      longitude,
    });

    res.json({
      message: 'Mechanic location updated',
      location: {
        ...result,
        estimatedArrivalMinutes: result.estimatedDurationMinutes,
        distanceKm: result.estimatedDistanceKm,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function adminReassignEmergency(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { newMechanicId, reason } = req.body;

    const updated = await emergencyService.adminReassignEmergency({
      requestId: id,
      adminId: req.user.userId,
      newMechanicId,
      reason,
    });

    res.json({
      message: 'Emergency technician reassigned successfully',
      emergency: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function cancelEmergencyRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { reason } = req.body;

    const updated = await emergencyService.cancelEmergencyRequest({
      requestId: id,
      actorId: req.user.userId,
      actorRole: req.user.role,
      reason,
    });

    res.json({
      message: 'Emergency request cancelled',
      emergency: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleProviderEmergencySettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { acceptsEmergency, emergencyRadiusKm } = req.body;

    const updated = await emergencyService.toggleProviderEmergencySettings({
      userId: req.user.userId,
      role: req.user.role,
      acceptsEmergency,
      emergencyRadiusKm,
    });

    res.json({
      message: `Emergency roadside service acceptance updated to ${acceptsEmergency ? 'ACTIVE' : 'INACTIVE'}`,
      settings: updated,
    });
  } catch (err) {
    next(err);
  }
}
