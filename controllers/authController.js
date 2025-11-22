const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const generateOTP = require('../utils/generateOTP');
const sendEmail = require('../utils/sendEmail');

// Generate JWT Token
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
};

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ErrorResponse('User already exists with this email', 400));
    }

    const user = await User.create({
      name,
      email,
      password,
      role
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new ErrorResponse('Please provide an email and password', 400));
    }

    const user = await User.findOne({ email, isActive: true }).select('+password');

    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email, isActive: true });

    if (!user) {
      return next(new ErrorResponse('There is no user with that email', 404));
    }

    const resetOTP = generateOTP();
    const resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.resetPasswordOTP = resetOTP;
    user.resetPasswordExpire = resetPasswordExpire;
    await user.save();

    const message = `Your password reset OTP is: ${resetOTP}\n\nThis OTP will expire in 10 minutes.`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'StockMaster - Password Reset OTP',
        message
      });

      res.status(200).json({
        success: true,
        message: 'OTP sent to email'
      });
    } catch (error) {
      user.resetPasswordOTP = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return next(new ErrorResponse('Email could not be sent', 500));
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordOTP: otp,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return next(new ErrorResponse('Invalid OTP or OTP expired', 400));
    }

    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    next(error);
  }
};