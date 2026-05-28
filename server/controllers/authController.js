import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured");
    error.status = 500;
    throw error;
  }
  return process.env.JWT_SECRET;
};

const signToken = (user) =>
  jwt.sign({ id: user._id.toString() }, getJwtSecret(), { expiresIn: "7d" });

const serializeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  handle: user.handle,
  bio: user.bio,
  location: user.location,
  player_role: user.player_role,
  followers_count: user.followers_count,
  following_count: user.following_count,
  is_verified: user.is_verified,
  authProvider: user.authProvider,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sendAuthResponse = (res, user) => {
  res.json({
    token: signToken(user),
    user: serializeUser(user),
  });
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({ message: "Account already exists. Try signing in." });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashed,
      authProvider: "manual",
    });

    sendAuthResponse(res.status(201), user);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const matches = await bcrypt.compare(password, user.password);

    if (!matches) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    sendAuthResponse(res, user);
  } catch (error) {
    next(error);
  }
};

export const me = async (req, res) => {
  res.json({ user: serializeUser(req.user) });
};

export const googleLogin = async (req, res, next) => {
  try {
    const { credential, accessToken } = req.body;
    let profile;

    if (credential) {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      profile = {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        avatar: payload.picture,
      };
    } else if (accessToken) {
      // Some OAuth clients return an access token instead of an ID token.
      // Google verifies the token before we use the profile response.
      await googleClient.getTokenInfo(accessToken);
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        return res.status(401).json({ message: "Invalid Google token" });
      }

      const data = await response.json();
      profile = {
        googleId: data.sub,
        email: data.email,
        name: data.name,
        avatar: data.picture,
      };
    } else {
      return res.status(400).json({ message: "Google token is required" });
    }

    if (!profile.email) {
      return res.status(400).json({ message: "Google account email is required" });
    }

    let user = await User.findOne({ email: profile.email.toLowerCase() });

    if (user) {
      if (!user.googleId) user.googleId = profile.googleId;
      if (!user.avatar && profile.avatar) user.avatar = profile.avatar;
      await user.save();
    } else {
      user = await User.create({
        name: profile.name || profile.email.split("@")[0],
        email: profile.email.toLowerCase(),
        googleId: profile.googleId,
        avatar: profile.avatar || null,
        authProvider: "google",
      });
    }

    sendAuthResponse(res, user);
  } catch (error) {
    error.status = 401;
    error.message = "Google login failed";
    next(error);
  }
};
