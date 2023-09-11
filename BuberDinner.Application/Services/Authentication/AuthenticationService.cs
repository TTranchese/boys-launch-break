using BuberDinner.Application.Common.Interfaces.Persistence;
using BuberDinner.Domain.Common.Errors;
using BuberDinner.Domain.Entities;
using ErrorOr;

namespace BuberDinner.Application.Services.Authentication;

public class AuthenticationService : IAuthenticationService
{
    private readonly IUserRepository _userRepository;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;

    public AuthenticationService(IUserRepository userRepository, IJwtTokenGenerator jwtTokenGenerator)
    {
        _userRepository = userRepository;
        _jwtTokenGenerator = jwtTokenGenerator;
    }
    public ErrorOr<AuthenticationResult> Login(string email, string password)
    {
        //Check if user exists
        if(_userRepository.GetUserByEmail(email) is not User user)
        {
            return Errors.Authentication.InvalidCredentials;
        }
        //Check if password is correct
        if (user.Password != password)
        {
            return Errors.Authentication.InvalidCredentials;
        }
        //Create jwt token and return it to the user
        var token = _jwtTokenGenerator.GenerateToken(user);

        return new AuthenticationResult(
            user,
            token
        );
    }
    public ErrorOr<AuthenticationResult> Register(string firstName, string lastName, string email, string password)
    {        
        //Validate the user doesn't exist
        if(_userRepository.GetUserByEmail(email) is not null)
        {
            return Errors.User.DuplicateEmail;
        }
        //Create user, generate unique ID, save to db
        var user = new User()
        {
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            Password = password
        };
        _userRepository.Add(user);
        
        //Create jwt token
        
        var token = _jwtTokenGenerator.GenerateToken(user); 
        return new AuthenticationResult(
            user,
            token
        );
    }
}