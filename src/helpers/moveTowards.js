export function moveTowards(person, destinationPosition, speed) {
  let distanceToTravelX = destinationPosition.x - person.position.x;
  let distanceToTravelY = destinationPosition.y - person.position.y;

  let distance = Math.sqrt(distanceToTravelX**2 + distanceToTravelY**2);

  const oldY = person.position.y;
  let yChanged = false;

  if (distance <= speed) {
    // If we're close enough, just move directly to the destination
    person.position.x = destinationPosition.x;
    person.position.y = destinationPosition.y;
    yChanged = oldY !== person.position.y;
  } else {
    // Otherwise, move by the specified speed in the direction of the destination
    let normalizedX = distanceToTravelX / distance;
    let normalizedY = distanceToTravelY / distance;

    person.position.x += normalizedX * speed;
    person.position.y += normalizedY * speed;
    yChanged = normalizedY !== 0;

    // Recalculate remaining distance after the move
    distanceToTravelX = destinationPosition.x - person.position.x;
    distanceToTravelY = destinationPosition.y - person.position.y;
    distance = Math.sqrt(distanceToTravelX**2 + distanceToTravelY**2);
  }

  // Invalidate parent sorting if Y position changed
  if (yChanged && person.invalidateParentSorting) {
    person.invalidateParentSorting();
  }

  return distance;
}