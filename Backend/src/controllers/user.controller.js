import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { mongoose } from "mongoose";
import jwt from "jsonwebtoken";



const generateAccessAndRefreshTokens = async(userid) => {
    try {
        const user = await User.findById(userid); //find user in db by id

        if (!user) {
            throw new ApiError(404, "User not found for token generation");
        }

        const accessToken = user.generateAccessTokens();
        const refreshToken = user.generateRefreshTokens();

        user.refreshToken = refreshToken; // assign value to refresh token
        await user.save({validateBeforeSave : false}) // save user

        return {accessToken, refreshToken};
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens");
    }
}

const registerUser = asyncHandler( async (req, res) => {
    // res.status(200).json({
    //     message: "Hello i am Akshat Rawat"
    // })
    

    /* 
    1. get user details from frontent 
    2. validate user authentication - not empty
    3. check if user already exits check from username and email
    4. check for images and check for avatar
    5. upload them to cloudinary and get it's url, check for avatar
    6. create user object - create entry in Datebase
    7. remove password and refresh token field from response
    8. check for user creation 
    9. return res
    */

    const {email, fullName, username, password} = req.body
    // console.log(email);

    if(
        [email, fullName, username, password].some((value) => value?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required");
    }
    
    const existedUser = await User.findOne({
        $or : [{ username }, { email }]// or operator
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username already exists");
    }

    // console.log(req.body);
    

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required");
    }

    // if(!coverImageLocalPath){
    //     throw new ApiError(400, "Avatar file is required");
    // }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400, "Avatar file is required");
    }

    const newUser = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    });
    
    const createdUser = await User.findById(newUser._id).select("-password -refreshToken");
    
    if (!createdUser) {
        throw new ApiError(500, "registration of User is unsuccessfull");
    }
    

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

const loginUser = asyncHandler( async (req,res) => {
    // req body -> data
    // username or email
    //find the user
    // password check
    // access and refresh tokens
    // send cookies (access and refresh tokens)

    const {email, username, password} = req.body;

    if(!username && !email){
        throw new ApiError(400, "username or password in required");
    }

    const user = await User.findOne({ 
        $or: [{username}, {email}] // or operator find user on the basis of either username is present or email is present
    })

    if(!user){
        throw new ApiError(404, "User doesn't exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid User Credentials");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully"
        )
    )



})

const logOutUser = asyncHandler( async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
              $unset: {
                refreshToken: 1,
              }  // can add more fields here that we want to update
        },
        {
            new: true // return new value with refreshToken undefined
        }
    )

    const options = { // can't update cookied in 
        httpOnly: true,
        secure: true
    }

    res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"))
})  

const refreshAccessToken = asyncHandler( async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }

    
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid Password");
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Password changed successfully")
    )
})

const getCurrentUser = asyncHandler( async (req, res) => {
    return res.status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler( async (req, res) => {
    const {fullName, email} = req.body;

    if(!fullName && !email){
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate( 
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))

})

const updateAvatar = asyncHandler( async (req, res) => {
    const avatarLocalPath = req.file?.path
    
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing");
    }
   
    const avatar = await uploadOnCloudinary(avatarLocalPath) 

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading on avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    )

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"))

})

const updateCoverImage = asyncHandler( async (req, res) => {
    const coverImageLocalPath = req.file?.path
    
    if(!coverImageLocalPath){
        throw new ApiError(400, "cover image file is missing");
    }
   
    const coverImage = await uploadOnCloudinary(coverImageLocalPath) 

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading on cover Image");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                coverImage : coverImage.url
            }
        },
        {new: true}
    )

    return res
    .status(200)
    .json(new ApiResponse(200, user, "coverImage updated successfully"))

})

const getUserChannelProfile = asyncHandler( async (req, res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([   // aggregation pipeline 
        {
            $match: {
                username : username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscriberCount: 1,
                channelsSubscribedToCount: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                isSubscribed: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )

})


const getWatchHistory = asyncHandler( async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                // _id : req.user._id // this will not work because mongoose doesn't work here code of ap passeson directly
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [ // Nested Pipelines
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]                   
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200, user[0].watchHistory, "watchhistory fetched successfully"
        )
    )

})


export {
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateCoverImage,
    updateAvatar,
    getUserChannelProfile,
    getWatchHistory
}
