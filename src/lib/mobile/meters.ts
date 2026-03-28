import { MeterAssignmentSource, Prisma } from "@prisma/client";
import { setMeterCustomerAssignment } from "@/lib/meters/assignments";
import { prisma } from "@/lib/prisma";

type LinkClientMeterPayload = {
  identifier?: string;
};

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function linkClientMeter(userId: string, payload: LinkClientMeterPayload) {
  const identifier = toTrimmedString(payload.identifier);
  if (!identifier) {
    return { status: 400, body: { error: "meter_identifier_required" } };
  }

  const meter = await prisma.meter.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { serialNumber: { equals: identifier, mode: Prisma.QueryMode.insensitive } },
        { meterReference: { equals: identifier, mode: Prisma.QueryMode.insensitive } },
      ],
    },
    select: {
      id: true,
      serialNumber: true,
      meterReference: true,
    },
  });

  if (!meter) {
    return { status: 404, body: { error: "meter_not_found" } };
  }

  try {
    const result = await setMeterCustomerAssignment({
      meterId: meter.id,
      customerId: userId,
      actorUserId: userId,
      source: MeterAssignmentSource.MOBILE_CLAIM,
      notes: "Linked from customer mobile app.",
      allowTransfer: false,
    });

    return {
      status: result.outcome === "unchanged" ? 200 : 201,
      body: {
        message: result.outcome === "unchanged" ? "meter_already_linked" : "meter_linked",
        meter: {
          id: meter.id,
          serialNumber: meter.serialNumber,
          meterReference: meter.meterReference,
        },
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === "meter_already_assigned") {
      return { status: 409, body: { error: "meter_already_assigned" } };
    }
    if (error instanceof Error && error.message === "customer_not_found") {
      return { status: 404, body: { error: "customer_not_found" } };
    }
    if (error instanceof Error && error.message === "meter_not_found") {
      return { status: 404, body: { error: "meter_not_found" } };
    }

    return { status: 400, body: { error: "invalid_request" } };
  }
}

