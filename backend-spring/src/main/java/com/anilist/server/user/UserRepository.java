package com.anilist.server.user;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface UserRepository extends MongoRepository<UserAccount, String> {
    Optional<UserAccount> findByEmail(String email);
}
