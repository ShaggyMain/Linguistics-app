import {
  formatAltitude,
  formatFrequency,
  formatHeading,
  formatPressure,
  formatSquawk,
  formatWind,
  spellDigits,
} from '../readout';

describe('readout formatting', () => {
  test('spells digits with ICAO niner/decimal', () => {
    expect(spellDigits('192')).toBe('one niner two');
    expect(spellDigits('119.1')).toBe('one one niner decimal one');
  });

  test('headings are 3-digit in both modes', () => {
    expect(formatHeading(5, 'digits')).toBe('005');
    expect(formatHeading(310, 'digits')).toBe('310');
    expect(formatHeading(310, 'aviation')).toBe('three one zero');
  });

  test('frequencies trim trailing zeros but keep one decimal', () => {
    expect(formatFrequency(118.7, 'digits')).toBe('118.7');
    expect(formatFrequency(124.85, 'digits')).toBe('124.85');
    expect(formatFrequency(121.0, 'digits')).toBe('121.0');
    expect(formatFrequency(119.1, 'aviation')).toBe('one one niner decimal one');
  });

  test('altitudes read as thousands in aviation mode', () => {
    expect(formatAltitude(4000, 'digits')).toBe('4000');
    expect(formatAltitude(4000, 'aviation')).toBe('four thousand');
    expect(formatAltitude(4500, 'aviation')).toBe('four thousand five hundred');
    expect(formatAltitude(11000, 'aviation')).toBe('one one thousand');
  });

  test('squawk codes spell digit by digit', () => {
    expect(formatSquawk('4271', 'digits')).toBe('4271');
    expect(formatSquawk('4271', 'aviation')).toBe('four two seven one');
  });

  test('wind with gusts', () => {
    expect(formatWind({ dir: 270, speed: 15, gust: 25 }, 'digits')).toBe('270 at 15 gusting 25');
    expect(formatWind({ dir: 240, speed: 8 }, 'aviation')).toBe('two four zero at eight');
  });

  test('pressure by unit', () => {
    expect(formatPressure(1013, 'hPa', 'digits')).toBe('1013');
    expect(formatPressure(29.92, 'inHg', 'digits')).toBe('29.92');
    expect(formatPressure(1013, 'hPa', 'aviation')).toBe('one zero one three');
    expect(formatPressure(29.92, 'inHg', 'aviation')).toBe('two niner niner two');
  });
});
