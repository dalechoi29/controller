import * as THREE from 'three';

/**
 * Math utilities for rotation calculations
 */

/**
 * Calculate ray-plane intersection point
 * @param {THREE.Ray} ray - Ray to intersect
 * @param {THREE.Plane} plane - Plane to intersect with
 * @returns {THREE.Vector3|null} - Intersection point or null if no intersection
 */
export function rayPlaneIntersection(ray, plane) {
  const target = new THREE.Vector3();
  const intersection = ray.intersectPlane(plane, target);
  
  if (intersection) {
    return intersection;
  }
  
  return null;
}

/**
 * Calculate signed angle between two vectors around an axis
 * @param {THREE.Vector3} v1 - First vector (should be normalized)
 * @param {THREE.Vector3} v2 - Second vector (should be normalized)
 * @param {THREE.Vector3} axis - Axis to measure rotation around (should be normalized)
 * @returns {number} - Signed angle in radians
 */
export function signedAngle(v1, v2, axis) {
  // Calculate the angle between vectors
  const angle = v1.angleTo(v2);
  
  // Determine the sign using the cross product
  const cross = new THREE.Vector3().crossVectors(v1, v2);
  const sign = Math.sign(cross.dot(axis));
  
  // Return signed angle
  return angle * sign;
}

/**
 * Create a quaternion from axis and angle
 * @param {THREE.Vector3} axis - Rotation axis (should be normalized)
 * @param {number} angle - Rotation angle in radians
 * @returns {THREE.Quaternion} - Resulting quaternion
 */
export function quaternionFromAxisAngle(axis, angle) {
  const quaternion = new THREE.Quaternion();
  quaternion.setFromAxisAngle(axis, angle);
  return quaternion;
}

/**
 * Clamp angle to snap increments (for snapping feature - Phase 6)
 * @param {number} angle - Angle in radians
 * @param {number} snapAngle - Snap increment in degrees
 * @returns {number} - Snapped angle in radians
 */
export function snapAngle(angle, snapAngle = 15) {
  const snapRadians = (snapAngle * Math.PI) / 180;
  return Math.round(angle / snapRadians) * snapRadians;
}

/**
 * Create a rotation plane perpendicular to the given axis
 * @param {THREE.Vector3} axis - Axis vector (X, Y, or Z)
 * @param {THREE.Vector3} point - Point on the plane (usually object position)
 * @returns {THREE.Plane} - Plane perpendicular to the axis
 */
export function createRotationPlane(axis, point) {
  // Plane normal is the axis itself
  const plane = new THREE.Plane();
  plane.setFromNormalAndCoplanarPoint(axis, point);
  return plane;
}

