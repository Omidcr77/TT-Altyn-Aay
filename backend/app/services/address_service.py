from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import Activity


def normalize_address(address_value: str | None, location_value: str | None = None) -> str | None:
    address = (address_value or "").strip()
    if address:
        return address
    location = (location_value or "").strip()
    if location and location != "-":
        return location
    return None


def normalize_location(location_value: str | None, address_value: str | None = None) -> str:
    address = normalize_address(address_value, location_value)
    return address or "-"


def backfill_activity_addresses(db: Session) -> int:
    rows = (
        db.query(Activity)
        .filter(
            or_(
                Activity.address.is_(None),
                Activity.address == "",
                Activity.location.is_(None),
                Activity.location == "",
            )
        )
        .all()
    )
    changed = 0
    for row in rows:
        new_address = normalize_address(row.address, row.location)
        new_location = normalize_location(row.location, new_address)
        if row.address != new_address or row.location != new_location:
            row.address = new_address
            row.location = new_location
            changed += 1
    if changed:
        db.commit()
    return changed
