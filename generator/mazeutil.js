/*
This function takes the random number generator and returns a wrapper function 
that returns a range of integers with linear distribution.

fxn(x): returns a number between 0 and (x-1)
fxn(x, y): returns a number between x and (x + y - 1)
*/
function generateIntegerWrapper(generator) {
	return function (...theArgs){
		var base = 0;
		var range = theArgs.shift();
		if (theArgs.length > 0) {
			base = range;
			range = theArgs.shift();
		}
		return Math.floor(generator() * range) + base;
	}
}

function newton(fxn, min, max, target){
	const avg = (min + max) / 2.0;
	if (avg == min || avg == max) {
		return avg;
	}
	const value = fxn(avg);
	if (target == value) {
		return avg;
	}
	// dir is true if fxn(max) is larger than fxn(min)
	const dir = fxn(max) > fxn(min);
	if ((value > target) == dir) {
		return newton(fxn, min, avg, target);
	}
	return newton(fxn, avg, max, target);
}

function fxnIterate(fxn, min, max, target, miny, maxy){
	if (miny === undefined){
		miny = fxn(min);
		maxy = fxn(max);
	}
	const avg = (min + max) / 2.0;
	if (avg == min || avg == max) {
		// We can't divide anymore.
		return avg;
	}
	const value = fxn(avg);
	if (target == value) {
		// We found a match.
		return avg;
	}
	// dir is true if fxn(max) is larger than fxn(min), that is the function is decreasing.
	const dir = maxy > miny;
	if ((value > target) == dir) {
		return fxnIterate(fxn, min, avg, target, miny, value);
	}
	return fxnIterate(fxn, avg, max, target, value, maxy);
}



/*
This function takes the random number generator and returns a wrapper function 
that returns a range of integers with sine distribution. The output number
is clamped to mean +/- range.

fxn(mean, range): returns an integer between (mean - range) and 
  (mean + range) with a sine distribution (bell curve) centered at the
  mean.
*/
function generateSineDistributedIntegerWrapper(generator) {
	return function (mean, range){		
		/*
		The area under the curve of the sine wave not hard to find.
		Base formula is y = 1 - cos
		Integral is y = x - sin x

		Problem is that we have the area and need the position on the curve.
		We use Newton's method to find this.
		It is safe becasue the function is continuous and always
		increasing.
		
		NOTE: Sadly, none of this is accurate.
		The sine wave goes up then down. The area under 1/2 a true sine wave is 1.
		Under a full wave this is 2. The texts cut the wave height in half:
		y = .5 * sin(x) where 0 >= x >= π 

		To get this, we need to split the wave in half and work on the side we are in.

		Also, Newton's method is for finding roots. But what we can do is find the answer by extrapolation:
		1. Find the area under the curve at the low and high test values.
		2. Identify the point at which to divide our test range.
		3. Test the area under the curve at the divide point.
		4. Keep the two lower values if the new test value is greater than the target area or 
		   keep the two higher values if the new test value is lower than teh target area.
		5. Repeat steps 2 through 4 until the point is at our test value or the low and high points are equal or pass each other.
		*/

		// Generate the probability and adjust it for the sine curve.
		const prob = generator();
		// The new adjustment is to flip the probability if it is over .5
		//const adjProb = prob * 2 * Math.PI;
		const adjProb = prob > .5 ? 1 - prob : prob;
		
		// We can use newton's method to find x (radians on the curve) that 
		// have prob area under the curve. 
		// The integral is continuous at all points for x >=0.
		//const x = newton(x => x - Math.sin(x), 0, 2 * Math.PI, adjProb);

		// WRONG: user a function iterate method instead.
		// Area under the curve is -cos(x) - -cos(0) where 0 >= x >= .5π
		// => 1 - cos(x)
		// We double the adjusted probability because our curve is full height.
		const x = fxnIterate(x => 1 - Math.cos(x), 0, .5 * Math.PI, adjProb * 2);


		// Scale x from between 0 and 2π to our desired range.
		// Plus 2: one for the mean and one so the highest value is possible.
		//const scale = x * (2 * range + 2) / (2 * Math.PI) + mean - range;

		// The result from x is from 0 to .5π.
		// Scale to 0 and .5 by dividing by π.
		const scale = x / Math.PI;

		// If we had to flip the curve, flip the answer.
		// The result should be between 0 and 1.
		const correctProportion = prob > .5 ? 1 - scale : scale;
		
		// Scale the proportion to our range then floor the result to an integer.
		// Note: If the sine probability is between m-r and m+r, m+r will not be a possibility if it is an integer.
		return Math.floor((correctProportion - 0.5) * range * 2 + mean);
	}
}
function factorial(num) {
	if (num <= 1) { return 1; }
	var result = num;
	while (--num > 1) { result *= num;}
	return result;
}

function binomial(tries, successProbability, successes) {
	const diff = tries - successes;
	const combo = factorial(tries) / (factorial(diff) * factorial(successes));
	return successProbability ** successes * (1.0 - successProbability) ** diff * combo;
}

function generateBinomialDistributedIntegerWrapper(generator) {
	return function (tries, successProbability, base = 0){		
		/*
		With tries and successProbability, a probability distribution for the 
		values 0 through tries can be generated.		
		*/
		// Generate the probability for the random number.
		const prob = generator();
		
		var running = 0, successes = 0;
		while (running <= prob) {
			running += binomial(tries, successProbability, successes++);			
		}		
		
		// Successes is one more than the number the random probability represents.
		return base + successes - 1;
	}
}